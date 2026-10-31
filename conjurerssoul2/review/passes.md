# Review passes (each pass gates the next; paid passes are minimised by catching problems in free ones)

0. **Locks** (free). `gen.py prompts` composes every prompt from the LOCK blocks and style2; read `out/prompts.json` once for continuity gates (kid eyebrow/throat scar, Tomas hair).
1. **Identity sheets** (cheap, image model). One reference per character and age (Orin 9 and 18, Vesper 12 and 21, Tomas before/after). Accept only if they match the LOCK text; these are the references for every still.
2. **Stills** (cheap). One start frame per shot into `out/stills/NN.png`, built from the sheets; a vision model scores identity against the sheet and the LOCK (retry up to 2x). This is where character consistency is actually won; text-only H3 drifts.
3. **Clips** (paid, `gen.py clips --go`). Run shots 1,5,14,18,25 first (hardest: children, resurrection, three-line dialogue, intimacy, the well). Review before committing to the other 23.
4. **Frame review** (free). `gen.py review` writes 3 frames per clip and a contact sheet per character; read each sheet for drift in hair, eyebrow, throat scar, age. Re-roll offenders with `--only N --seed M`.
5. **Dialogue pass.** Listen to each clip; re-roll any with garbled or missing lines. Lip sync problems on close-ups can use the lipsync post-pass.
6. **Music alignment.** `audiokp kp` -> hits and sections; confirm the 4:05 quiet is a cut-to-black and the movement changes land on shot boundaries.
7. **Assembly and full watch.** `gen.py assemble`, then two full viewings: one for story clarity with no sound, one for audio mix (score ducks under speech).
