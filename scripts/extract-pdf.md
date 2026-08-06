# Extracting text from a knowledge base PDF

Used when adding a new Pitch Perfect AI playbook to `src/lib/ai/knowledge/`.

```bash
pip install pypdf
python3 -c "
from pypdf import PdfReader
reader = PdfReader('playbook.pdf')
text = '\n'.join((page.extract_text() or '') for page in reader.pages)
open('playbook.txt', 'w').write(text)
"
```

If `pypdf` fails to import with a `cryptography`/`_cffi_backend` error, run
`pip install --force-reinstall cffi` first.

Then condense `playbook.txt` by hand into a `NN-slug.md` file following the pattern of the
existing files in `src/lib/ai/knowledge/` — pull out named frameworks, phase tables, and
operating rules; drop prose, quotes, and exercises. See that folder's `README.md` for the
full checklist.
