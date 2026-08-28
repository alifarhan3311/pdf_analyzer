import pymupdf  # PyMuPDF
from PIL import Image
import io

def convert_pdf_to_images(pdf_path, dpi=200):
    images = []
    doc = pymupdf.open(pdf_path)
    # zoom factor for DPI. Default is 72, so 200/72 = 2.77
    zoom = dpi / 72.0
    mat = pymupdf.Matrix(zoom, zoom)
    
    for page in doc:
        pix = page.get_pixmap(matrix=mat)
        img = Image.open(io.BytesIO(pix.tobytes("png")))
        images.append(img)
    return images
