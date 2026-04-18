import os
import sys

try:
    import PyPDF2
except ImportError:
    os.system(f"{sys.executable} -m pip install PyPDF2")
    import PyPDF2

pdf_path = '2022_PV_impresso_D1_CD1.pdf'
out_path = '2022_extracted.txt'

try:
    with open(pdf_path, 'rb') as file:
        reader = PyPDF2.PdfReader(file)
        text = ""
        # Only read first 30 pages to make it faster
        for i in range(min(len(reader.pages), 30)):
            page_text = reader.pages[i].extract_text()
            if page_text:
                text += page_text + "\n"
        with open(out_path, 'w', encoding='utf-8') as f:
            f.write(text)
    print("Success")
except Exception as e:
    print(f"Error: {e}")
