TEXTURES = $(wildcard i/_sources/*.png) $(wildcard i/_sources/*.jpg)
ASSETS = $(wildcard a/_sources/*.png) $(wildcard a/_sources/*.jpg)
BACKDROPS = $(wildcard a/backdrops/_sources/*.png) $(wildcard a/backdrops/_sources/*.jpg)
IMAGES = $(TEXTURES) $(ASSETS) $(BACKDROPS)
FONTS = $(wildcard i/_sources/*.ttf)
OUTPUT_IMAGES = $(subst /_sources/,/,$(patsubst %.jpg,%.webp,$(IMAGES:.png=.webp)) $(FONTS:.ttf=.woff2))
OUTPUT_THUMBS = $(subst /_sources/,/t/,$(patsubst %.jpg,%.webp,$(ASSETS:.png=.webp)))
OUTPUT_MEDIUMS = $(subst /_sources/,/m/,$(patsubst %.jpg,%.webp,$(TEXTURES:.png=.webp)))
OUTPUTS = $(OUTPUT_IMAGES) $(OUTPUT_MEDIUMS) $(OUTPUT_THUMBS)

CWEBP = cwebp -q 75 -alpha_q 75 -m 6 -mt
CBACKDROP = cwebp -q 15 -m 6 -mt -noalpha -resize 0 540
CMEDIUM = cwebp -q 60 -alpha_q 75 -m 6 -resize 0 512
CTHUMB = cwebp -q 30 -m 6 -resize 0 48

i/%.webp: i/_sources/%.png
	$(CWEBP) $< -o $@
i/m/%.webp: i/_sources/%.png
	mkdir -p i/m
	$(CMEDIUM) $< -o $@
i/m/%.webp: i/_sources/%.jpg
	mkdir -p i/m
	$(CMEDIUM) $< -o $@
i/%.webp: i/_sources/%.jpg
	$(CWEBP) $< -o $@
a/%.webp: a/_sources/%.png
	$(CWEBP) $< -o $@
a/t/%.webp: a/_sources/%.png
	mkdir -p a/t
	$(CTHUMB) $< -o $@
a/%.webp: a/_sources/%.jpg
	$(CWEBP) $< -o $@
a/t/%.webp: a/_sources/%.jpg
	mkdir -p a/t
	$(CTHUMB) $< -o $@
a/backdrops/%.webp: a/backdrops/_sources/%.png
	$(CBACKDROP) $< -o $@
a/backdrops/%.webp: a/backdrops/_sources/%.jpg
	$(CBACKDROP) $< -o $@

i/%.woff2: i/_sources/%.ttf
	woff2_compress $<
	mv $(patsubst %.ttf,%.woff2,$<) $@

all: $(OUTPUTS)

clean:
	rm -f $(wildcard i/*.woff2) $(wildcard i/*.webp) $(wildcard a/*.webp) $(wildcard a/backdrops/*.webp)

beta:
	jekyll build -b beta -d ~/Documents/build/rockaysavvy/beta
main:
	jekyll build -d ~/Documents/build/rockaysavvy

.PHONY: all beta main clean
