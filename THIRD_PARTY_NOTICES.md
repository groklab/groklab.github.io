# Third-party notices

This repository does not declare a license for its own code or content. The
following font and map assets retain their respective upstream terms.

## LXGW WenKai GB

- File: `static/fonts/LXGWWenKaiGB-Regular.ttf`
- Version: 1.522
- Source: <https://github.com/lxgw/LxgwWenKaiGB/releases/tag/v1.522>
- SHA-256: `295568c131648062107543aa159c97dd49564be791136c2abf74cad83eba3f7f`
- License: SIL Open Font License 1.1, reproduced in
  `static/fonts/OFL-LXGW-WenKai-GB.txt`

The font file is the unmodified upstream TTF. The site uses the upstream font
name and does not imply endorsement by its authors.

## Newsreader

- Files: `static/fonts/Newsreader-Variable.woff2` and
  `static/fonts/Newsreader-Italic-Variable.woff2`
- Version: 1.003
- Source: <https://github.com/productiontype/Newsreader/tree/cfcb4f7af0e52c25e8df2a2431814c8e5fe2e155/fonts/variable/woff2>
- SHA-256 (roman):
  `1faa3380ac0e87e057b180e03fd94bd708a612afb67d2590677be4508909fae9`
- SHA-256 (italic):
  `d184d5e6a967ffea109d9f99fa245eccbff221e27f30bfd7d6fdb2940fcc6265`
- License: SIL Open Font License 1.1, reproduced in
  `static/fonts/OFL-Newsreader.txt`

The two files are unmodified upstream variable WOFF2 fonts. The site uses the
upstream font name and does not imply endorsement by its authors.

## STIX Two Math

- File: `static/fonts/STIXTwoMath-Regular.ttf`
- Version: 2.12 b168a
- Source: <https://github.com/google/fonts/tree/main/ofl/stixtwomath>
- SHA-256 (math):
  `562551b15b836e6e01d1b7350909baf3c8c8d83260c1190fbf4544333e6936de`
- License: SIL Open Font License 1.1, reproduced in
  `static/fonts/OFL-STIX-Two.txt`

The file is the unmodified upstream regular TTF. STIX Fonts is a trademark of
The Institute of Electrical and Electronics Engineers, Inc.

## Natural Earth 1:110m land

- Generated file: `visitor-map/src/world-path.mjs`
- Source file: `ne_110m_land.shp`
- Source: <https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/110m_physical/ne_110m_land.shp>
- Source SHA-256:
  `8689e6932b8e370e2ca4587cf3ba21e460b1235db37b6ed3c172c35b4a6088de`
- Generated-file SHA-256:
  `3ccc2e6ddf9447263ced08cd815739021d446a22166484fd355d45fa95536587`
- Terms: public domain, as stated by Natural Earth at
  <https://www.naturalearthdata.com/about/terms-of-use/>

`visitor-map/tools/generate_world_path.py` verifies the source hash, reads the
polygon records, applies a 720 by 360 equirectangular projection, and emits the
derived SVG path. No Natural Earth code or runtime service is included.
