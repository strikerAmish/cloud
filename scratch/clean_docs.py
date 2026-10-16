import re

def clean_file(infile, outfile):
    with open(infile, encoding='utf-8') as f:
        text = f.read()
    
    # In pypdf extract, words are often separated by \n or \n \n
    # Let's fix line breaks where words are broken
    text = re.sub(r'([A-Za-z0-9,\.:;!?"\'-])\s*\n\s*([A-Za-z0-9,\.:;!?"\'-])', r'\1 \2', text)
    with open(outfile, 'w', encoding='utf-8') as f:
        f.write(text)
    print(f"Cleaned {infile} -> {outfile}")

clean_file('master_doc_dump.txt', 'master_clean.txt')
clean_file('rail_ai_dump.txt', 'rail_ai_clean.txt')
