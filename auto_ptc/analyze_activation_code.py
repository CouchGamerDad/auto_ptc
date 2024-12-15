import sys
from pytesseract import image_to_string
from PIL import Image
import re

def extract_code(image_path):
    try:
        # Load image and process with Tesseract
        image = Image.open(image_path)
        text = image_to_string(image)

        # Match for 6-digit activation code
        match = re.search(r'\b\d{6}\b', text)
        if match:
            print(match.group(0))  # Print activation code to stdout
        else:
            print("No activation code found.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python analyze_activation_code.py <image_path>")
        sys.exit(1)
    
    image_path = sys.argv[1]
    extract_code(image_path)
