/**
 * The film-emulation prompt.
 *
 * Target look: an unedited early-2000s disposable camera snapshot — indoor,
 * flash-dominant, coarse 35mm grain.
 *
 * GUARDS are load-bearing, not style. They stop the model recomposing the shot,
 * altering faces, or drawing a border — the photo is displayed and saved
 * full-bleed, so anything the model draws around it becomes part of the image.
 */
const LOOK = `Transform the image into an authentic early-2000s disposable camera photograph. The look should feel like it was taken with a cheap point-and-shoot camera using a powerful built-in flash indoors at night. The flash should be the dominant light source, making the subject noticeably brighter while the background remains significantly darker. Use authentic coarse 35mm film grain, random dust, tiny scratches, and subtle film scanning imperfections—not digital noise. Apply warm yellow highlights, slightly olive-green shadows, deep blacks, moderate contrast, and preserve natural skin texture without beauty smoothing. Reduce digital sharpness slightly, add subtle plastic lens softness, mild chromatic aberration, a faint vignette, and soft flash bloom. The final image should feel raw, candid, nostalgic, imperfect, and unmistakably analog—not like a modern digital photo with a vintage filter.`;

const GUARDS = `STRICT RULES — these override every stylistic instruction above:

This is a colour-grading and film-emulation task ONLY. You are applying a look to an existing photograph, not generating a new image. Treat the input as immutable content.

Do NOT alter faces in any way. Preserve every facial feature exactly as-is: identity, bone structure, jawline, nose, eyes, eyebrows, lips, teeth, hairline, facial hair, skin marks, moles, blemishes, wrinkles, and expression. Do not beautify, slim, smooth, symmetrise, reshape, age, or de-age anyone. The person must remain unmistakably the same person.
Do NOT add, remove, move, replace, or redesign any object, person, animal, or background element. Nothing that is absent from the input may appear in the output, and nothing present may disappear.
Do NOT change the composition, framing, crop, camera angle, perspective, or the position and pose of anything in the frame.
Do NOT invent scenery, light sources, lamps, windows, furniture, reflections, or cast shadows that are not already in the input.
Do NOT reinterpret the scene, change what it depicts, or make it "look like" a different photograph.
Do NOT add any border, white frame, caption, watermark, or text.
Do NOT add a date stamp, timestamp, clock, or any burned-in date or time. Disposable and point-and-shoot cameras of this era often printed an orange date in the corner — do not reproduce that. The image must contain no numbers, digits, or date text anywhere, in any corner, in any colour.

Only the following may change: colour, tone, contrast, exposure, grain, texture, sharpness, vignetting, chromatic aberration, and flash-style lighting falloff.

If any stylistic instruction above would require altering content, ignore that instruction and preserve the original content instead.

Output a full-bleed square image with no padding.`;

export function buildPrompt(): string {
  return `${LOOK}\n\n${GUARDS}`;
}
