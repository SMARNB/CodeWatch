import os
import shutil
from pathlib import Path

# ============================================================
# CONFIGURATION — UPDATE THESE PATHS
# ============================================================

# Path to the downloaded Dian dataset (extracted ZIP)
DIAN_DATASET_PATH = r"C:\Users\alira\OneDrive\Documents\FYP\BackEnd\dian_dataset"

# Path where extracted sleeveless images will be saved
OUTPUT_PATH = r"C:\Users\alira\OneDrive\Documents\FYP\BackEnd\sleeveless_extracted"

# ============================================================
# CLASS MAPPING
# ============================================================

# Dian dataset classes (from their data.yaml)
DIAN_CLASSES = {
    0: 'Bodysuit',
    1: 'Croptop',
    2: 'Hoodie',
    3: 'Long-sleeve',
    4: 'Off-the-shoulder',
    5: 'Polo-shirt',
    6: 'Shirt',
    7: 'Sleeveless',
    8: 'Sport-bra',
    9: 'T_shirt',
    10: 'Tank-top',
    11: 'Tube-top',
    12: 'Turtleneck'
}

# Classes we want to extract (all will become "m-sleeveless" in our dataset)
TARGET_CLASSES = {1, 4, 7, 8, 10, 11}  # Croptop, Off-the-shoulder, Sleeveless, Sport-bra, Tank-top, Tube-top

# Our existing dataset has 14 classes (index 0-13)
# The new class "m-sleeveless" will be index 14
NEW_CLASS_INDEX = 14

# ============================================================
# EXTRACTION LOGIC
# ============================================================

def extract_and_convert():
    """Extract target class images and convert labels."""
    
    # Create output directories
    output_images = os.path.join(OUTPUT_PATH, "images")
    output_labels = os.path.join(OUTPUT_PATH, "labels")
    os.makedirs(output_images, exist_ok=True)
    os.makedirs(output_labels, exist_ok=True)
    
    # Track statistics
    stats = {
        'total_images_scanned': 0,
        'images_with_target': 0,
        'total_target_annotations': 0,
        'skipped_other_annotations': 0,
        'by_class': {}
    }
    
    for cls_name in DIAN_CLASSES.values():
        stats['by_class'][cls_name] = 0
    
    # Process train, valid, and test splits
    for split in ['train', 'valid', 'test']:
        images_dir = os.path.join(DIAN_DATASET_PATH, split, "images")
        labels_dir = os.path.join(DIAN_DATASET_PATH, split, "labels")
        
        if not os.path.exists(images_dir):
            print(f"  Skipping {split}/ — directory not found")
            continue
        
        if not os.path.exists(labels_dir):
            print(f"  Skipping {split}/ — labels directory not found")
            continue
        
        print(f"\nProcessing {split}/...")
        
        # Get all label files
        label_files = [f for f in os.listdir(labels_dir) if f.endswith('.txt')]
        
        for label_file in label_files:
            stats['total_images_scanned'] += 1
            label_path = os.path.join(labels_dir, label_file)
            
            # Read all annotations in this label file
            with open(label_path, 'r') as f:
                lines = f.readlines()
            
            # Filter for target classes only
            target_lines = []
            has_target = False
            
            for line in lines:
                parts = line.strip().split()
                if len(parts) < 5:
                    continue
                
                class_idx = int(parts[0])
                
                if class_idx in TARGET_CLASSES:
                    # Convert class index to our new index (14 = m-sleeveless)
                    new_line = f"{NEW_CLASS_INDEX} {' '.join(parts[1:])}\n"
                    target_lines.append(new_line)
                    has_target = True
                    stats['total_target_annotations'] += 1
                    stats['by_class'][DIAN_CLASSES[class_idx]] += 1
                else:
                    stats['skipped_other_annotations'] += 1
            
            if not has_target:
                continue
            
            stats['images_with_target'] += 1
            
            # Find the corresponding image file
            image_name_base = os.path.splitext(label_file)[0]
            image_found = False
            
            for ext in ['.jpg', '.jpeg', '.png', '.bmp', '.webp']:
                image_file = image_name_base + ext
                image_path = os.path.join(images_dir, image_file)
                
                if os.path.exists(image_path):
                    # Create unique filename to avoid collisions
                    unique_prefix = f"slv_{split}_{stats['images_with_target']:04d}"
                    
                    # Copy image
                    dest_image = os.path.join(output_images, f"{unique_prefix}{ext}")
                    shutil.copy2(image_path, dest_image)
                    
                    # Write converted label file (ONLY target class annotations)
                    dest_label = os.path.join(output_labels, f"{unique_prefix}.txt")
                    with open(dest_label, 'w') as f:
                        f.writelines(target_lines)
                    
                    image_found = True
                    break
            
            if not image_found:
                print(f"  WARNING: Image not found for label {label_file}")
    
    # Print summary
    print("\n" + "=" * 60)
    print("EXTRACTION COMPLETE")
    print("=" * 60)
    print(f"Total images scanned: {stats['total_images_scanned']}")
    print(f"Images with target classes: {stats['images_with_target']}")
    print(f"Total target annotations: {stats['total_target_annotations']}")
    print(f"Skipped non-target annotations: {stats['skipped_other_annotations']}")
    print(f"\nBreakdown by class:")
    for cls_name, count in stats['by_class'].items():
        if count > 0:
            marker = " ✓ EXTRACTED" if DIAN_CLASSES[list(DIAN_CLASSES.keys())[list(DIAN_CLASSES.values()).index(cls_name)]] in [DIAN_CLASSES[i] for i in TARGET_CLASSES] else ""
            print(f"  {cls_name}: {count}{marker}")
    print(f"\nOutput saved to: {OUTPUT_PATH}")
    print(f"  Images: {output_images}")
    print(f"  Labels: {output_labels}")
    print(f"\nNext step: Run merge_datasets.py to add these to your training data")


if __name__ == '__main__':
    print("=" * 60)
    print("SLEEVELESS IMAGE EXTRACTOR")
    print("Code Watch Dress Code Dataset Enhancement")
    print("=" * 60)
    
    # Verify Dian dataset exists
    if not os.path.exists(DIAN_DATASET_PATH):
        print(f"\nERROR: Dian dataset not found at:")
        print(f"  {DIAN_DATASET_PATH}")
        print(f"\nPlease:")
        print(f"  1. Download from: https://universe.roboflow.com/dian-dlcbc/fashon/dataset/2")
        print(f"  2. Export as YOLOv8 format")
        print(f"  3. Extract the ZIP to: {DIAN_DATASET_PATH}")
        exit(1)
    
    extract_and_convert()
