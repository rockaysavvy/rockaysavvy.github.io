IMAGES = $(wildcard i/_sources/*.png) $(wildcard i/_sources/*.jpg) $(wildcard a/_sources/*.png) $(wildcard a/_sources/*.jpg) $(wildcard a/backdrops/_sources/*.png) $(wildcard a/backdrops/_sources/*.jpg)
FONTS = $(wildcard i/_sources/*.ttf)
OUTPUTS = $(subst /_sources/,/,$(patsubst %.jpg,%.webp,$(IMAGES:.png=.webp)) $(FONTS:.ttf=.woff2))

CWEBP = cwebp -q 80 -m 6
CBACKDROP = cwebp -q 20 -m 6

i/%.webp: i/_sources/%.png
	$(CWEBP) $< -o $@
i/%.webp: i/_sources/%.jpg
	$(CWEBP) $< -o $@
a/%.webp: a/_sources/%.png
	$(CWEBP) $< -o $@
a/%.webp: a/_sources/%.jpg
	$(CWEBP) $< -o $@
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
