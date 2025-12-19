"""Create placeholder icons for ReaRead Chrome Extension"""
from PIL import Image, ImageDraw, ImageFont

def create_icon(size, filename, color="#4A90E2", inactive=False):
    """Create a simple circular icon"""
    # Create image with transparent background
    img = Image.new('RGBA', (size, size), (255, 255, 255, 0))
    draw = ImageDraw.Draw(img)

    # Draw circle
    margin = size // 8
    circle_color = "#999999" if inactive else color
    draw.ellipse([margin, margin, size-margin, size-margin], fill=circle_color)

    # Draw eye symbol (simplified)
    if size >= 32:
        eye_margin = size // 3
        eye_width = size - (2 * eye_margin)
        eye_height = eye_width // 2
        eye_y = (size - eye_height) // 2

        # Eye outline
        draw.ellipse([eye_margin, eye_y, size-eye_margin, eye_y+eye_height],
                     fill="white", outline=circle_color, width=2)

        # Pupil
        pupil_size = size // 6
        pupil_x = size // 2 - pupil_size // 2
        pupil_y = size // 2 - pupil_size // 2
        draw.ellipse([pupil_x, pupil_y, pupil_x+pupil_size, pupil_y+pupil_size],
                     fill=circle_color)

    img.save(filename)
    print(f"Created: {filename}")

# Create all required icons
icons_dir = "extension/icons/"

create_icon(16, f"{icons_dir}icon16.png")
create_icon(48, f"{icons_dir}icon48.png")
create_icon(128, f"{icons_dir}icon128.png")
create_icon(128, f"{icons_dir}icon128-inactive.png", inactive=True)

print("\nAll icons created successfully!")
