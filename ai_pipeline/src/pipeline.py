import argparse
import yaml
import os
import glob
from pdf_to_images import convert_pdf_to_images
from ocr_extractor import extract_transactions
from excel_writer import write_to_excel
import json

def load_config():
    with open(os.path.join(os.path.dirname(__file__), '../config.yaml'), 'r') as f:
        return yaml.safe_load(f)

def main():
    parser = argparse.ArgumentParser(description="Bank Statement OCR Pipeline")
    parser.add_argument('--input', required=False, help="Folder containing PDFs")
    parser.add_argument('--template', required=False, help="Path to Excel template")
    parser.add_argument('--file', required=False, help="Single PDF file to process")
    parser.add_argument('--json-out', action='store_true', help="Output raw JSON to stdout")
    args = parser.parse_args()

    config = load_config()
    
    if args.file:
        pdf_files = [args.file]
    elif args.input:
        pdf_files = glob.glob(os.path.join(args.input, '*.pdf'))
    else:
        print("Error: Must provide either --input or --file")
        return
    
    if not args.json_out:
        print(f"Found {len(pdf_files)} PDFs to process.")
        
    all_transactions = []

    for pdf_path in pdf_files:
        if not args.json_out:
            print(f"Processing {pdf_path}...")
        images = convert_pdf_to_images(pdf_path, config['dpi'])
        
        for i, img in enumerate(images):
            if not args.json_out:
                print(f"  OCR on page {i+1}...")
            raw_json = extract_transactions(img, config['model_name'], config['prompt'])
            
            try:
                # Basic cleanup
                if raw_json.startswith('```json'):
                    raw_json = raw_json.split('```json')[1].split('```')[0].strip()
                elif raw_json.startswith('```'):
                    raw_json = raw_json.split('```')[1].split('```')[0].strip()
                
                transactions = json.loads(raw_json)
                for t in transactions:
                    t['sourceFile'] = os.path.basename(pdf_path)
                    all_transactions.append(t)
            except Exception as e:
                if not args.json_out:
                    print(f"  Failed to parse JSON on page {i+1}: {e}")

    if args.json_out:
        print("---JSON_START---")
        print(json.dumps(all_transactions))
        print("---JSON_END---")
    else:
        print(f"Extraction complete. Total transactions: {len(all_transactions)}")
        if args.template:
            write_to_excel(all_transactions, args.template, config['excel_columns'])
            print("Done writing to Excel.")

if __name__ == "__main__":
    main()
