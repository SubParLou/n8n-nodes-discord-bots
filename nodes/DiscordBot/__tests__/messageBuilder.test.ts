import type { INode } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import {
  buildAllComponentsFromUi,
  buildAutoSelectsFromUi,
  buildComponentsFromUi,
  buildEmbedsFromUi,
  buildStringSelectsFromUi,
  parseEmbedColor,
  type AutoSelectMenuUiParams,
  type ButtonUiParams,
  type EmbedUiParams,
  type StringSelectMenuUiParams,
} from '../messageBuilder';

// Minimal INode mock sufficient for NodeOperationError
const mockNode: INode = {
  id: 'test-node',
  name: 'Test Node',
  type: 'discordBot',
  typeVersion: 1,
  position: [0, 0],
  parameters: {},
} as INode;

// ─── parseEmbedColor ─────────────────────────────────────────────────────────

describe('parseEmbedColor', () => {
  it('converts a hex color with # prefix to an integer', () => {
    expect(parseEmbedColor('#0099ff', mockNode)).toBe(0x0099ff);
  });

  it('converts a hex color without # prefix to an integer', () => {
    expect(parseEmbedColor('5865F2', mockNode)).toBe(0x5865f2);
  });

  it('is case-insensitive', () => {
    expect(parseEmbedColor('#FF0000', mockNode)).toBe(0xff0000);
    expect(parseEmbedColor('#ff0000', mockNode)).toBe(0xff0000);
  });

  it('returns undefined for an empty string', () => {
    expect(parseEmbedColor('', mockNode)).toBeUndefined();
  });

  it('returns undefined for a whitespace-only string', () => {
    expect(parseEmbedColor('   ', mockNode)).toBeUndefined();
  });

  it('throws NodeOperationError for an invalid hex value', () => {
    expect(() => parseEmbedColor('ZZZZZZ', mockNode)).toThrow(NodeOperationError);
  });

  it('throws NodeOperationError for a 3-digit hex value', () => {
    expect(() => parseEmbedColor('#FFF', mockNode)).toThrow(NodeOperationError);
  });
});

// ─── buildEmbedsFromUi ────────────────────────────────────────────────────────

describe('buildEmbedsFromUi', () => {
  it('returns an empty array for no embeds', () => {
    expect(buildEmbedsFromUi([], mockNode)).toEqual([]);
  });

  it('omits empty string fields', () => {
    const embed: EmbedUiParams = {
      title: 'Hello',
      description: '',
      url: '',
      color: '',
      thumbnailUrl: '',
      imageUrl: '',
      footerText: '',
      authorName: '',
      timestamp: '',
    };
    const [result] = buildEmbedsFromUi([embed], mockNode);
    expect(result.title).toBe('Hello');
    expect(result.description).toBeUndefined();
    expect(result.url).toBeUndefined();
    expect(result.color).toBeUndefined();
    expect(result.thumbnail).toBeUndefined();
    expect(result.image).toBeUndefined();
    expect(result.footer).toBeUndefined();
    expect(result.author).toBeUndefined();
    expect(result.timestamp).toBeUndefined();
  });

  it('converts hex color to integer', () => {
    const [result] = buildEmbedsFromUi([{ color: '#0099ff' }], mockNode);
    expect(result.color).toBe(0x0099ff);
  });

  it('builds thumbnail, image, footer and author correctly', () => {
    const embed: EmbedUiParams = {
      thumbnailUrl: 'https://example.com/thumb.png',
      imageUrl: 'https://example.com/img.png',
      footerText: 'Footer',
      footerIconUrl: 'https://example.com/icon.png',
      authorName: 'Author',
      authorUrl: 'https://example.com/author',
      authorIconUrl: 'https://example.com/author-icon.png',
    };
    const [result] = buildEmbedsFromUi([embed], mockNode);
    expect(result.thumbnail).toEqual({ url: 'https://example.com/thumb.png' });
    expect(result.image).toEqual({ url: 'https://example.com/img.png' });
    expect(result.footer).toEqual({ text: 'Footer', icon_url: 'https://example.com/icon.png' });
    expect(result.author).toEqual({
      name: 'Author',
      url: 'https://example.com/author',
      icon_url: 'https://example.com/author-icon.png',
    });
  });

  it('builds embed fields correctly', () => {
    const embed: EmbedUiParams = {
      embedFields: {
        field: [
          { name: 'Field 1', value: 'Value 1', inline: true },
          { name: 'Field 2', value: 'Value 2', inline: false },
        ],
      },
    };
    const [result] = buildEmbedsFromUi([embed], mockNode);
    expect(result.fields).toHaveLength(2);
    expect(result.fields?.[0]).toEqual({ name: 'Field 1', value: 'Value 1', inline: true });
    expect(result.fields?.[1]).toEqual({ name: 'Field 2', value: 'Value 2', inline: false });
  });

  it('omits fields array when no embed fields are provided', () => {
    const [result] = buildEmbedsFromUi([{ title: 'Test' }], mockNode);
    expect(result.fields).toBeUndefined();
  });

  it('throws when more than 10 embeds are provided', () => {
    const embeds = Array.from({ length: 11 }, (_, i) => ({ title: `Embed ${i}` }));
    expect(() => buildEmbedsFromUi(embeds, mockNode)).toThrow(NodeOperationError);
  });

  it('throws when embed title exceeds 256 characters', () => {
    expect(() =>
      buildEmbedsFromUi([{ title: 'a'.repeat(257) }], mockNode),
    ).toThrow(NodeOperationError);
  });

  it('throws when embed description exceeds 4096 characters', () => {
    expect(() =>
      buildEmbedsFromUi([{ description: 'a'.repeat(4097) }], mockNode),
    ).toThrow(NodeOperationError);
  });

  it('throws when more than 25 embed fields are provided', () => {
    const fields = Array.from({ length: 26 }, (_, i) => ({
      name: `Field ${i}`,
      value: `Value ${i}`,
      inline: false,
    }));
    expect(() =>
      buildEmbedsFromUi([{ embedFields: { field: fields } }], mockNode),
    ).toThrow(NodeOperationError);
  });

  it('omits footer icon_url when not provided', () => {
    const [result] = buildEmbedsFromUi([{ footerText: 'Hello' }], mockNode);
    expect(result.footer).toEqual({ text: 'Hello' });
    expect((result.footer as { icon_url?: string }).icon_url).toBeUndefined();
  });
});

// ─── buildComponentsFromUi ───────────────────────────────────────────────────

describe('buildComponentsFromUi', () => {
  it('returns an empty array for no buttons', () => {
    expect(buildComponentsFromUi([], mockNode)).toEqual([]);
  });

  it('groups buttons into rows of 5', () => {
    const buttons: ButtonUiParams[] = Array.from({ length: 6 }, (_, i) => ({
      label: `Button ${i + 1}`,
      style: 2 as const,
      customId: `btn-${i + 1}`,
      url: '',
      disabled: false,
    }));
    const rows = buildComponentsFromUi(buttons, mockNode);
    expect(rows).toHaveLength(2);
    // First row should have 5 buttons, second should have 1
    expect((rows[0] as any).components).toHaveLength(5);
    expect((rows[1] as any).components).toHaveLength(1);
  });

  it('sets type:1 on action rows and type:2 on buttons', () => {
    const buttons: ButtonUiParams[] = [
      { label: 'Click', style: 1, customId: 'btn-1', url: '', disabled: false },
    ];
    const [row] = buildComponentsFromUi(buttons, mockNode);
    expect((row as any).type).toBe(1);
    expect((row as any).components[0].type).toBe(2);
  });

  it('uses custom_id for non-link buttons', () => {
    const buttons: ButtonUiParams[] = [
      { label: 'Click', style: 1, customId: 'my-id', url: '', disabled: false },
    ];
    const [[row]] = [buildComponentsFromUi(buttons, mockNode)];
    expect((row as any).components[0].custom_id).toBe('my-id');
    expect((row as any).components[0].url).toBeUndefined();
  });

  it('uses url for link buttons', () => {
    const buttons: ButtonUiParams[] = [
      { label: 'Visit', style: 5, customId: '', url: 'https://example.com', disabled: false },
    ];
    const [row] = buildComponentsFromUi(buttons, mockNode);
    expect((row as any).components[0].url).toBe('https://example.com');
    expect((row as any).components[0].custom_id).toBeUndefined();
  });

  it('throws when a link button has no URL', () => {
    const buttons: ButtonUiParams[] = [
      { label: 'Bad Link', style: 5, customId: '', url: '', disabled: false },
    ];
    expect(() => buildComponentsFromUi(buttons, mockNode)).toThrow(NodeOperationError);
  });

  it('throws when a non-link button has no custom_id', () => {
    const buttons: ButtonUiParams[] = [
      { label: 'Bad Button', style: 1, customId: '', url: '', disabled: false },
    ];
    expect(() => buildComponentsFromUi(buttons, mockNode)).toThrow(NodeOperationError);
  });

  it('throws when more than 25 buttons are provided', () => {
    const buttons: ButtonUiParams[] = Array.from({ length: 26 }, (_, i) => ({
      label: `Button ${i + 1}`,
      style: 2 as const,
      customId: `btn-${i + 1}`,
      url: '',
      disabled: false,
    }));
    expect(() => buildComponentsFromUi(buttons, mockNode)).toThrow(NodeOperationError);
  });

  it('sets disabled flag when true', () => {
    const buttons: ButtonUiParams[] = [
      { label: 'Disabled', style: 2, customId: 'btn', url: '', disabled: true },
    ];
    const [row] = buildComponentsFromUi(buttons, mockNode);
    expect((row as any).components[0].disabled).toBe(true);
  });

  it('omits disabled property when false', () => {
    const buttons: ButtonUiParams[] = [
      { label: 'Active', style: 2, customId: 'btn', url: '', disabled: false },
    ];
    const [row] = buildComponentsFromUi(buttons, mockNode);
    expect((row as any).components[0].disabled).toBeUndefined();
  });

  it('includes emoji when emojiName or emojiId is set', () => {
    const buttons: ButtonUiParams[] = [
      {
        label: 'React',
        style: 1,
        customId: 'btn',
        url: '',
        disabled: false,
        emojiName: '🎉',
        emojiId: '',
      },
    ];
    const [row] = buildComponentsFromUi(buttons, mockNode);
    expect((row as any).components[0].emoji).toEqual({ name: '🎉' });
  });

  it('groups exactly 5 buttons into one row', () => {
    const buttons: ButtonUiParams[] = Array.from({ length: 5 }, (_, i) => ({
      label: `Button ${i + 1}`,
      style: 2 as const,
      customId: `btn-${i + 1}`,
      url: '',
      disabled: false,
    }));
    const rows = buildComponentsFromUi(buttons, mockNode);
    expect(rows).toHaveLength(1);
    expect((rows[0] as any).components).toHaveLength(5);
  });
});

// ─── buildStringSelectsFromUi ────────────────────────────────────────────────

function makeStringSelect(overrides: Partial<StringSelectMenuUiParams> = {}): StringSelectMenuUiParams {
  return {
    customId: 'my-select',
    disabled: false,
    maxValues: 1,
    minValues: 1,
    placeholder: '',
    selectOptions: {
      option: [{ label: 'Option 1', value: 'opt1', description: '', default: false, emojiName: '', emojiId: '', emojiAnimated: false }],
    },
    ...overrides,
  };
}

describe('buildStringSelectsFromUi', () => {
  it('returns an empty array for no selects', () => {
    expect(buildStringSelectsFromUi([], mockNode)).toEqual([]);
  });

  it('sets type:3 on the select component and type:1 on the action row', () => {
    const [row] = buildStringSelectsFromUi([makeStringSelect()], mockNode);
    expect((row as any).type).toBe(1);
    expect((row as any).components[0].type).toBe(3);
  });

  it('sets custom_id on the component', () => {
    const [row] = buildStringSelectsFromUi([makeStringSelect({ customId: 'my-dropdown' })], mockNode);
    expect((row as any).components[0].custom_id).toBe('my-dropdown');
  });

  it('includes option label and value', () => {
    const [row] = buildStringSelectsFromUi([makeStringSelect()], mockNode);
    expect((row as any).components[0].options[0]).toMatchObject({ label: 'Option 1', value: 'opt1' });
  });

  it('omits optional option fields when blank/false', () => {
    const [row] = buildStringSelectsFromUi([makeStringSelect()], mockNode);
    const opt = (row as any).components[0].options[0];
    expect(opt.description).toBeUndefined();
    expect(opt.default).toBeUndefined();
    expect(opt.emoji).toBeUndefined();
  });

  it('includes option description when set', () => {
    const select = makeStringSelect();
    select.selectOptions.option![0].description = 'My description';
    const [row] = buildStringSelectsFromUi([select], mockNode);
    expect((row as any).components[0].options[0].description).toBe('My description');
  });

  it('includes option default:true when set', () => {
    const select = makeStringSelect();
    select.selectOptions.option![0].default = true;
    const [row] = buildStringSelectsFromUi([select], mockNode);
    expect((row as any).components[0].options[0].default).toBe(true);
  });

  it('includes placeholder when set', () => {
    const [row] = buildStringSelectsFromUi([makeStringSelect({ placeholder: 'Pick one' })], mockNode);
    expect((row as any).components[0].placeholder).toBe('Pick one');
  });

  it('omits placeholder when empty', () => {
    const [row] = buildStringSelectsFromUi([makeStringSelect({ placeholder: '' })], mockNode);
    expect((row as any).components[0].placeholder).toBeUndefined();
  });

  it('includes min_values and max_values when not default (1)', () => {
    const [row] = buildStringSelectsFromUi([makeStringSelect({ minValues: 0, maxValues: 3 })], mockNode);
    expect((row as any).components[0].min_values).toBe(0);
    expect((row as any).components[0].max_values).toBe(3);
  });

  it('omits min_values and max_values when they are 1', () => {
    const [row] = buildStringSelectsFromUi([makeStringSelect({ minValues: 1, maxValues: 1 })], mockNode);
    expect((row as any).components[0].min_values).toBeUndefined();
    expect((row as any).components[0].max_values).toBeUndefined();
  });

  it('sets disabled when true', () => {
    const [row] = buildStringSelectsFromUi([makeStringSelect({ disabled: true })], mockNode);
    expect((row as any).components[0].disabled).toBe(true);
  });

  it('omits disabled when false', () => {
    const [row] = buildStringSelectsFromUi([makeStringSelect({ disabled: false })], mockNode);
    expect((row as any).components[0].disabled).toBeUndefined();
  });

  it('throws when customId is empty', () => {
    expect(() => buildStringSelectsFromUi([makeStringSelect({ customId: '' })], mockNode)).toThrow(NodeOperationError);
  });

  it('throws when no options are provided', () => {
    expect(() =>
      buildStringSelectsFromUi([makeStringSelect({ selectOptions: { option: [] } })], mockNode),
    ).toThrow(NodeOperationError);
  });

  it('throws when more than 25 options are provided', () => {
    const options = Array.from({ length: 26 }, (_, i) => ({
      label: `Option ${i}`,
      value: `opt${i}`,
      description: '',
      default: false,
      emojiName: '',
      emojiId: '',
      emojiAnimated: false,
    }));
    expect(() =>
      buildStringSelectsFromUi([makeStringSelect({ selectOptions: { option: options } })], mockNode),
    ).toThrow(NodeOperationError);
  });
});

// ─── buildAutoSelectsFromUi ──────────────────────────────────────────────────

function makeAutoSelect(overrides: Partial<AutoSelectMenuUiParams> = {}): AutoSelectMenuUiParams {
  return {
    selectType: 5,
    customId: 'auto-select',
    disabled: false,
    maxValues: 1,
    minValues: 1,
    placeholder: '',
    channelTypes: [],
    ...overrides,
  };
}

describe('buildAutoSelectsFromUi', () => {
  it('returns an empty array for no selects', () => {
    expect(buildAutoSelectsFromUi([], mockNode)).toEqual([]);
  });

  it('sets the correct type for User Select (5)', () => {
    const [row] = buildAutoSelectsFromUi([makeAutoSelect({ selectType: 5 })], mockNode);
    expect((row as any).components[0].type).toBe(5);
  });

  it('sets the correct type for Role Select (6)', () => {
    const [row] = buildAutoSelectsFromUi([makeAutoSelect({ selectType: 6 })], mockNode);
    expect((row as any).components[0].type).toBe(6);
  });

  it('sets the correct type for Mentionable Select (7)', () => {
    const [row] = buildAutoSelectsFromUi([makeAutoSelect({ selectType: 7 })], mockNode);
    expect((row as any).components[0].type).toBe(7);
  });

  it('sets the correct type for Channel Select (8)', () => {
    const [row] = buildAutoSelectsFromUi([makeAutoSelect({ selectType: 8 })], mockNode);
    expect((row as any).components[0].type).toBe(8);
  });

  it('wraps each select in an action row (type:1)', () => {
    const [row] = buildAutoSelectsFromUi([makeAutoSelect()], mockNode);
    expect((row as any).type).toBe(1);
  });

  it('sets channel_types for Channel Select when provided', () => {
    const [row] = buildAutoSelectsFromUi([makeAutoSelect({ selectType: 8, channelTypes: [0, 2] })], mockNode);
    expect((row as any).components[0].channel_types).toEqual([0, 2]);
  });

  it('omits channel_types for Channel Select when empty', () => {
    const [row] = buildAutoSelectsFromUi([makeAutoSelect({ selectType: 8, channelTypes: [] })], mockNode);
    expect((row as any).components[0].channel_types).toBeUndefined();
  });

  it('omits channel_types for non-Channel Select types', () => {
    const [row] = buildAutoSelectsFromUi([makeAutoSelect({ selectType: 5, channelTypes: [0, 2] })], mockNode);
    expect((row as any).components[0].channel_types).toBeUndefined();
  });

  it('throws when customId is empty', () => {
    expect(() => buildAutoSelectsFromUi([makeAutoSelect({ customId: '' })], mockNode)).toThrow(NodeOperationError);
  });
});

// ─── buildAllComponentsFromUi ────────────────────────────────────────────────

describe('buildAllComponentsFromUi', () => {
  const btn = (): ButtonUiParams => ({ label: 'B', style: 2, customId: 'b', url: '', disabled: false });
  const strSel = (): StringSelectMenuUiParams => makeStringSelect();
  const autoSel = (): AutoSelectMenuUiParams => makeAutoSelect();

  it('returns empty array when all inputs are empty', () => {
    expect(buildAllComponentsFromUi([], [], [], mockNode)).toEqual([]);
  });

  it('combines button rows, string selects, and auto selects in order', () => {
    const rows = buildAllComponentsFromUi([btn()], [strSel()], [autoSel()], mockNode);
    // 1 button row + 1 string select row + 1 auto select row = 3 rows
    expect(rows).toHaveLength(3);
    expect((rows[0] as any).components[0].type).toBe(2); // button
    expect((rows[1] as any).components[0].type).toBe(3); // string select
    expect((rows[2] as any).components[0].type).toBe(5); // auto select (user)
  });

  it('throws when total action rows exceed 5', () => {
    // 5 buttons = 1 row; 3 string selects = 3 rows; 2 auto selects = 2 rows → 6 total
    const buttons = Array.from({ length: 5 }, () => btn());
    const stringSelects = [strSel(), strSel(), strSel()];
    const autoSelects = [autoSel(), autoSel()];
    expect(() =>
      buildAllComponentsFromUi(buttons, stringSelects, autoSelects, mockNode),
    ).toThrow(NodeOperationError);
  });

  it('allows exactly 5 action rows', () => {
    const stringSelects = [strSel(), strSel(), strSel(), strSel(), strSel()];
    expect(() =>
      buildAllComponentsFromUi([], stringSelects, [], mockNode),
    ).not.toThrow();
  });
});
