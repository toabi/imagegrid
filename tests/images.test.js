import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isImageFile } from '../public/images.js';

test('isImageFile accepts image types and untyped files', () => {
    assert.equal(isImageFile({ type: 'image/png' }), true);
    assert.equal(isImageFile({ type: 'image/svg+xml' }), true);
    // Browsers report '' for extensions the OS doesn't know (e.g. .avif on
    // some systems); those are tried and rejected only if decoding fails.
    assert.equal(isImageFile({ type: '' }), true);
    assert.equal(isImageFile({ type: 'application/pdf' }), false);
    assert.equal(isImageFile({ type: 'text/plain' }), false);
});
