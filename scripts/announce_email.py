#!/usr/bin/env python3
"""One-off announcement blast to ManifoldGen users via SES SMTP.

Run on prod from the repo root (reads .env for DATABASE_URL and SES creds):
  python3 scripts/announce_email.py --template emails/announce-kling4.html \
      --subject "..." --sent-file /tmp/announce-kling4.sent [--to a@b.c] [--dry-run]

Skips unsubscribed users and email_optouts, dedupes by lowercased email, and
records each success in --sent-file so reruns never double-send.
"""
import argparse, os, secrets, smtplib, subprocess, sys, time, urllib.parse, re

def load_env(path=".env"):
    env = {}
    for line in open(path):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            env[k] = v.strip().strip('"').strip("'")
    return env

def recipients(dsn):
    q = ("select distinct lower(email) from users u where email like '%@%' and not unsubscribed "
         "and not exists (select 1 from email_optouts o where o.email=lower(u.email)) order by 1")
    out = subprocess.run(["psql", dsn, "-Atc", q], check=True, capture_output=True, text=True).stdout
    return [l for l in out.splitlines() if l]

def build(env, to, subject, html):
    unsub = "https://manifoldgen.com/unsubscribe?email=" + urllib.parse.quote(to)
    html = html.replace("{{.Email}}", to).replace("{{.UnsubscribeURL}}", unsub)
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text).strip()[:600] + "\n\nUnsubscribe: " + unsub
    frm = "%s <%s>" % (env.get("SES_FROM_NAME", "ManifoldGen"), env.get("SES_FROM_EMAIL", "lee.penkman@netwrck.com"))
    b = "----=_Part_" + secrets.token_hex(8)
    msg = (f"From: {frm}\r\nTo: {to}\r\nSubject: {subject}\r\nMIME-Version: 1.0\r\n"
           f"Content-Type: multipart/alternative; boundary=\"{b}\"\r\n"
           f"List-Unsubscribe: <{unsub}>\r\nList-Unsubscribe-Post: List-Unsubscribe=One-Click\r\n\r\n"
           f"--{b}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n{text}\r\n"
           f"--{b}\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n{html}\r\n--{b}--\r\n")
    return frm, msg

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--template", required=True)
    ap.add_argument("--subject", required=True)
    ap.add_argument("--sent-file", required=True)
    ap.add_argument("--to", action="append", help="send only to these addresses (test)")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--delay", type=float, default=0.3)
    a = ap.parse_args()
    env = load_env()
    html = open(a.template).read()
    sent = set(open(a.sent_file).read().split()) if os.path.exists(a.sent_file) else set()
    users = a.to if a.to else recipients(env["DATABASE_URL"])
    todo = [u for u in users if a.to or u not in sent]
    print(f"recipients={len(users)} already_sent={len(users)-len(todo)} to_send={len(todo)}")
    if a.dry_run:
        return
    host = "email-smtp.%s.amazonaws.com" % (env.get("AWS_REGION") or "us-east-1")
    srv = smtplib.SMTP_SSL(host, 465, timeout=30)
    srv.login(env["AWS_SMTP_USERNAME"], env["AWS_SMTP_PASSWORD"])
    ok = fail = 0
    for u in todo:
        frm, msg = build(env, u, a.subject, html)
        try:
            srv.sendmail(frm.split("<")[1].rstrip(">"), [u], msg.encode())
            ok += 1
            if not a.to:
                open(a.sent_file, "a").write(u + "\n")
        except Exception as e:
            fail += 1
            print("fail", u, e, file=sys.stderr)
            if isinstance(e, (smtplib.SMTPServerDisconnected,)):
                srv = smtplib.SMTP_SSL(host, 465, timeout=30)
                srv.login(env["AWS_SMTP_USERNAME"], env["AWS_SMTP_PASSWORD"])
        time.sleep(a.delay)
    srv.quit()
    print(f"sent={ok} failed={fail}")

if __name__ == "__main__":
    main()
