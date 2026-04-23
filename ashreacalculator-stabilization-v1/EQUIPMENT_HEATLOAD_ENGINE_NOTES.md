# Equipment Heat Load Engine — Clean Integration

## What this package adds
- Medical, lab, and clinical support equipment added to the existing device engine
- Room-based recommended equipment presets
- Structured equipment summary saved into history
- Equipment BTU shown in history, quotation, and technical report
- Technical report block listing selected equipment and total heat load

## Integration approach
This package uses the existing device workflow to avoid breaking UI behavior, while upgrading it into a true equipment heat load layer.

## Next recommended phase
- Add dedicated UI filters per hospital category
- Add default auto-load presets by room type
- Add validation and warnings for unusually high equipment load
