"""
Merge extracted sleeveless images into the Code Watch dress code dataset.

USAGE:
1. First run extract_sleeveless.py to get the extracted images
2. Then run this script to merge them into your training dataset
3. After merging, retrain the model with train_dresscode.py

Author: Code Watch FYP
"""

import os
import shutil
import yaml
from pathlib import Path

# ============================================================
# CONFIGURATION — UPDATE THESE PATHS
# ============================================================

# Path to extracted sleeveless images (output of extract_sleeveless.py)
EXTRACTED_PATH = r"C:\Users\alira\OneDrive\Documents\FYP\BackEnd\sleeveless_extracted"

# Path to your existing dress code dataset
DATASET_PATH = r"C:\Users\alira\OneDrive\Documents\FYP\BackEnd\FYP.v5i.yolo26"

# ============================================================
# MERGE LOGIC
# ============================================================

def merge_datasets():
    """Merge extracted sleeveless images into the existing dataset."""
    
    extracted_images = os.path.join(EXTRACTED_PATH, "images")
    extracted_labels = os.path.join(EXTRACTED_PATH, "labels")
    
    # Verify paths exist
    if not os.path.exists(extracted_images):
        print(f"ERROR: Extracted images not found at {extracted_images}")
        print("Run extract_sleeveless.py first!")
        exit(1)
    
    if not os.path.exists(DATASET_PATH):
        print(f"ERROR: Dataset not found at {DATASET_PATH}")
        exit(1)
    
    # Count extracted files
    image_files = [f for f in os.listdir(extracted_images) if f.endswith(('.jpg', '.jpeg', '.png'))]
    label_files = [f for f in os.listdir(extracted_labels) if f.endswith('.txt')]
    
    print(f"Found {len(image_files)} extracted images and {len(label_files)} label files")
    
    if len(image_files) == 0:
        print("ERROR: No images found in extracted folder!")
        exit(1)
    
    # Split: 80% train, 15% valid, 5% test
    total = len(image_files)
    train_count = int(total * 0.80)
    valid_count = int(total * 0.15)
    test_count = total - train_count - valid_count
    
    print(f"\nSplit plan:")
    print(f"  Train: {train_count} images")
    print(f"  Valid: {valid_count} images")
    print(f"  Test:  {test_count} images")
    
    # Sort for consistent splitting
    image_files.sort()
    
    train_images = image_files[:train_count]
    valid_images = image_files[train_count:train_count + valid_count]
    test_images = image_files[train_count + valid_count:]
    
    splits = {
        'train': train_images,
        'valid': valid_images,
        'test': test_images
    }
    
    copied_count = 0
    
    for split_name, split_images in splits.items():
        dest_images_dir = os.path.join(DATASET_PATH, split_name, "images")
        dest_labels_dir = os.path.join(DATASET_PATH, split_name, "labels")
        
        # Ensure directories exist
        os.makedirs(dest_images_dir, exist_ok=True)
        os.makedirs(dest_labels_dir, exist_ok=True)
        
        for img_file in split_images:
            # Copy image
            src_img = os.path.join(extracted_images, img_file)
            dst_img = os.path.join(dest_images_dir, img_file)
            
            if not os.path.exists(dst_img):
                shutil.copy2(src_img, dst_img)
            
            # Copy corresponding label
            label_file = os.path.splitext(img_file)[0] + ".txt"
            src_lbl = os.path.join(extracted_labels, label_file)
            dst_lbl = os.path.join(dest_labels_dir, label_file)
            
            if os.path.exists(src_lbl) and not os.path.exists(dst_lbl):
                shutil.copy2(src_lbl, dst_lbl)
            
            copied_count += 1
        
        print(f"  Copied {len(split_images)} images to {split_name}/")
    
    # ============================================================
    # UPDATE data.yaml
    # ============================================================
    
    data_yaml_path = os.path.join(DATASET_PATH, "data.yaml")
    
    # Read existing data.yaml
    with open(data_yaml_path, 'r') as f:
        data_config = yaml.safe_load(f)
    
    # Backup original data.yaml
    backup_path = os.path.join(DATASET_PATH, "data_backup.yaml")
    if not os.path.exists(backup_path):
        shutil.copy2(data_yaml_path, backup_path)
        print(f"\nBacked up original data.yaml to data_backup.yaml")
    
    # Check if m-sleeveless already exists
    current_names = data_config.get('names', [])
    
    if 'm-sleeveless' not in current_names:
        # Add the new class
        current_names.append('m-sleeveless')
        data_config['names'] = current_names
        data_config['nc'] = len(current_names)
        
        # Update paths to absolute
        data_config['train'] = os.path.join(DATASET_PATH, 'train', 'images').replace('\\', '/')
        data_config['val'] = os.path.join(DATASET_PATH, 'valid', 'images').replace('\\', '/')
        data_config['test'] = os.path.join(DATASET_PATH, 'test', 'images').replace('\\', '/')
        
        # Write updated data.yaml
        with open(data_yaml_path, 'w') as f:
            yaml.dump(data_config, f, default_flow_style=False, sort_keys=False)
        
        print(f"\nUpdated data.yaml:")
        print(f"  nc: {data_config['nc']} (was {data_config['nc'] - 1})")
        print(f"  Added class: 'm-sleeveless' at index {len(current_names) - 1}")
    else:
        print(f"\n'm-sleeveless' already exists in data.yaml (index {current_names.index('m-sleeveless')})")
    
    # ============================================================
    # VERIFY
    # ============================================================
    
    print("\n" + "=" * 60)
    print("MERGE COMPLETE")
    print("=" * 60)
    print(f"Total images copied: {copied_count}")
    print(f"\nUpdated dataset at: {DATASET_PATH}")
    print(f"  Classes: {data_config['nc']}")
    print(f"  Names: {data_config['names']}")
    
    # Count total images per split
    for split_name in ['train', 'valid', 'test']:
        split_dir = os.path.join(DATASET_PATH, split_name, "images")
        if os.path.exists(split_dir):
            count = len([f for f in os.listdir(split_dir) if f.endswith(('.jpg', '.jpeg', '.png'))])
            print(f"  {split_name}: {count} images")
    
    print(f"\nNext step: Run the training script to retrain the model")
    print(f"  python train_dresscode.py")
    print(f"\nDon't forget to update FinalSystem.py compliance rules:")
    print(f"  VIOLATION_MALE = {{'m-informal-pants', 'm-sleeveless'}}")


if __name__ == '__main__':
    print("=" * 60)
    print("DATASET MERGER")
    print("Code Watch Dress Code Dataset Enhancement")
    print("=" * 60)
    
    # Check for PyYAML
    try:
        import yaml
    except ImportError:
        print("Installing PyYAML...")
        os.system("pip install pyyaml --break-system-packages")
        import yaml
    
    merge_datasets()
