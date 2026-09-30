import runpy, sys, urllib.request as u
o = u.build_opener(); o.addheaders = [("User-Agent", "curl/8.10")]; u.install_opener(o)
sys.argv = sys.argv[1:]
runpy.run_path(sys.argv[0], run_name="__main__")
