from PIL import Image
imgs = ['logo_dark.png','logo_light.png','card_front.png','card_back.png','brand_palette.png','banner_digital.png','icon_512.png']
for name in imgs:
    img = Image.open(name)
    print(f'{name}: {img.size} mode={img.mode}')
