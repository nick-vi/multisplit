#!/bin/bash

# Get dimensions of the image
WIDTH=$(magick identify -format "%w" multisplit-logo.png)
HEIGHT=$(magick identify -format "%h" multisplit-logo.png)

# Calculate radius (30% of the smaller dimension for very visible rounding)
RADIUS=$(echo "scale=0; $(($WIDTH<$HEIGHT?$WIDTH:$HEIGHT)) * 0.3 / 1" | bc)

# Print debug info
echo "Image dimensions: ${WIDTH}x${HEIGHT}, Radius: ${RADIUS}"

# Method 1: Create a mask with rounded corners
magick -size ${WIDTH}x${HEIGHT} xc:black -fill white \
  -draw "roundrectangle 0,0 $((WIDTH-1)),$((HEIGHT-1)) ${RADIUS},${RADIUS}" \
  mask1.png

# Apply the mask to create rounded corners
magick multisplit-logo.png -matte mask1.png -compose DstIn -composite multisplit-logo-rounded.png

# Clean up temporary files
rm mask1.png

echo "Created rounded logo: multisplit-logo-rounded.png"
