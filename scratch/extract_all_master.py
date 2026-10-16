import pypdf

reader = pypdf.PdfReader('master_document.pdf')
print("Total pages in master_document.pdf:", len(reader.pages))

with open('scratch/master_doc_full.txt', 'w', encoding='utf-8') as out:
    for i, page in enumerate(reader.pages):
        out.write(f"\n==================== MASTER DOC PAGE {i+1} ====================\n")
        text = page.extract_text() or ''
        out.write(text)
        out.write("\n")

print("Saved scratch/master_doc_full.txt successfully!")
