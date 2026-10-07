import os

import numpy as np
import rasterio
import matplotlib.pyplot as plt


# ============================================================
# CHROMASAT AI
# Sentinel-2 GeoTIFF Preview Generator
# ============================================================

INPUT_FILE = "test-data/Nandyal_Sentinel2_Test.tif"
OUTPUT_DIR = "test-data/previews"

os.makedirs(OUTPUT_DIR, exist_ok=True)


# ------------------------------------------------------------
# Read GeoTIFF
# ------------------------------------------------------------

with rasterio.open(INPUT_FILE) as src:
    image = src.read().astype(np.float32)

    print("========================================")
    print("CHROMASAT SATELLITE DATA")
    print("========================================")
    print("Width :", src.width)
    print("Height:", src.height)
    print("Bands :", src.count)
    print("CRS   :", src.crs)
    print()

    # Sentinel-2 bands exported by our Colab code
    B2 = image[0]   # Blue
    B3 = image[1]   # Green
    B4 = image[2]   # Red
    B8 = image[3]   # NIR
    B11 = image[4]  # SWIR
    B12 = image[5]  # SWIR


# ------------------------------------------------------------
# Helper: percentile stretch
# ------------------------------------------------------------

def stretch_band(band):
    low = np.percentile(band, 2)
    high = np.percentile(band, 98)

    stretched = (band - low) / (high - low + 1e-8)

    return np.clip(stretched, 0, 1)


# ------------------------------------------------------------
# 1. TRUE COLOR RGB
# ------------------------------------------------------------

red = stretch_band(B4)
green = stretch_band(B3)
blue = stretch_band(B2)

rgb = np.dstack([red, green, blue])

plt.figure(figsize=(10, 8))
plt.imshow(rgb)
plt.title("CHROMASAT AI — Sentinel-2 True Color")
plt.axis("off")
plt.tight_layout()

rgb_path = os.path.join(
    OUTPUT_DIR,
    "Nandyal_Sentinel2_RGB.png"
)

plt.savefig(rgb_path, dpi=200, bbox_inches="tight")
plt.close()


# ------------------------------------------------------------
# 2. NDVI
# NDVI = (NIR - RED) / (NIR + RED)
# ------------------------------------------------------------

ndvi = (B8 - B4) / (B8 + B4 + 1e-8)

plt.figure(figsize=(10, 8))
plt.imshow(ndvi, vmin=-1, vmax=1, cmap="RdYlGn")
plt.colorbar(label="NDVI")
plt.title("CHROMASAT AI — NDVI Vegetation Index")
plt.axis("off")
plt.tight_layout()

ndvi_path = os.path.join(
    OUTPUT_DIR,
    "Nandyal_Sentinel2_NDVI.png"
)

plt.savefig(ndvi_path, dpi=200, bbox_inches="tight")
plt.close()


# ------------------------------------------------------------
# 3. NDWI
# NDWI = (GREEN - NIR) / (GREEN + NIR)
# ------------------------------------------------------------

ndwi = (B3 - B8) / (B3 + B8 + 1e-8)

plt.figure(figsize=(10, 8))
plt.imshow(ndwi, vmin=-1, vmax=1, cmap="Blues")
plt.colorbar(label="NDWI")
plt.title("CHROMASAT AI — NDWI Water Index")
plt.axis("off")
plt.tight_layout()

ndwi_path = os.path.join(
    OUTPUT_DIR,
    "Nandyal_Sentinel2_NDWI.png"
)

plt.savefig(ndwi_path, dpi=200, bbox_inches="tight")
plt.close()


# ------------------------------------------------------------
# 4. Basic statistics
# ------------------------------------------------------------

print("NDVI:")
print("  Minimum :", float(np.nanmin(ndvi)))
print("  Maximum :", float(np.nanmax(ndvi)))
print("  Mean    :", float(np.nanmean(ndvi)))
print()

print("NDWI:")
print("  Minimum :", float(np.nanmin(ndwi)))
print("  Maximum :", float(np.nanmax(ndwi)))
print("  Mean    :", float(np.nanmean(ndwi)))
print()

print("========================================")
print("PREVIEWS CREATED")
print("========================================")
print(rgb_path)
print(ndvi_path)
print(ndwi_path)