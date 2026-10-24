/**
 * Tests for alert templates.
 */
import { describe, it, expect } from 'vitest';
import { getTemplate, renderTemplate, TEMPLATES } from '../src/protocol/templates';

describe('Templates', () => {
  it('has at least 5 templates', () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(5);
  });

  it('looks up template by ID', () => {
    const tpl = getTemplate(0x01);
    expect(tpl).toBeDefined();
    expect(tpl!.en).toContain('Flood');
  });

  it('returns undefined for unknown template', () => {
    const tpl = getTemplate(0xff);
    expect(tpl).toBeUndefined();
  });

  it('renders English', () => {
    const text = renderTemplate(0x01, 'en');
    expect(text).toContain('DRILL');
    expect(text).toContain('Flood');
  });

  it('renders Malayalam', () => {
    const text = renderTemplate(0x01, 'ml');
    expect(text).toContain('DRILL');
    expect(text.length).toBeGreaterThan(10);
  });

  it('renders Hindi', () => {
    const text = renderTemplate(0x01, 'hi');
    expect(text).toContain('DRILL');
  });

  it('renders unknown template gracefully', () => {
    const text = renderTemplate(0xff, 'en');
    expect(text).toContain('Unknown');
  });

  it('every template has all three languages', () => {
    for (const tpl of TEMPLATES) {
      expect(tpl.en.length).toBeGreaterThan(0);
      expect(tpl.ml.length).toBeGreaterThan(0);
      expect(tpl.hi.length).toBeGreaterThan(0);
    }
  });
});
