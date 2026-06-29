import type { INode } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import {
  buildAllComponentsFromUi,
  buildAutoSelectsFromUi,
  buildComponentsFromUi,
  buildEmbedsFromUi,
  buildModalFromUi,
  buildStringSelectsFromUi,
  parseEmbedColor,
  type AutoSelectMenuUiParams,
  type ButtonUiParams,
  type ContainerUiParams,
  type EmbedUiParams,
  type FileUiParams,
  type MediaGalleryUiParams,
  type ModalUiParams,
  type SectionUiParams,
  type SeparatorUiParams,
  type StringSelectMenuUiParams,
  type TextDisplayUiParams,
  type TextInputUiParams,
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
    expect(buildAllComponentsFromUi([], [], [], [], [], [], [], [], [], mockNode)).toEqual([]);
  });

  it('combines button rows, string selects, and auto selects in order', () => {
    const rows = buildAllComponentsFromUi([btn()], [strSel()], [autoSel()], [], [], [], [], [], [], mockNode);
    // 1 button row + 1 string select row + 1 auto select row = 3 rows
    expect(rows).toHaveLength(3);
    expect((rows[0] as any).components[0].type).toBe(2); // button
    expect((rows[1] as any).components[0].type).toBe(3); // string select
    expect((rows[2] as any).components[0].type).toBe(5); // auto select (user)
  });

  it('supports top-level layout blocks alongside action rows', () => {
    const rows = buildAllComponentsFromUi(
      [],
      [],
      [],
      [{ content: 'Hello world' }],
      [{ title: 'Section title', content: 'Section body', thumbnailUrl: '' }],
      [{ type: 'horizontal' }],
      [{ title: 'Container title', content: 'Container body', accentColor: '#ff0000' }],
      [{ images: ['https://example.com/image.png'] }],
      [{ fileUrl: 'https://example.com/file.txt', fileName: 'file.txt' }],
      mockNode,
    );
    expect(rows).toHaveLength(6);
    expect((rows[0] as any).type).toBe(10);
    expect((rows[1] as any).type).toBe(9);
    expect((rows[2] as any).type).toBe(14);
    expect((rows[3] as any).type).toBe(17);
    expect((rows[4] as any).type).toBe(12);
    expect((rows[5] as any).type).toBe(13);
  });

  it('throws when total action rows exceed 5', () => {
    // 5 buttons = 1 row; 3 string selects = 3 rows; 2 auto selects = 2 rows → 6 total
    const buttons = Array.from({ length: 5 }, () => btn());
    const stringSelects = [strSel(), strSel(), strSel()];
    const autoSelects = [autoSel(), autoSel()];
    expect(() =>
      buildAllComponentsFromUi(buttons, stringSelects, autoSelects, [], [], [], [], [], [], mockNode),
    ).toThrow(NodeOperationError);
  });

  it('allows exactly 5 action rows', () => {
    const stringSelects = [strSel(), strSel(), strSel(), strSel(), strSel()];
    expect(() =>
      buildAllComponentsFromUi([], stringSelects, [], [], [], [], [], [], [], mockNode),
    ).not.toThrow();
  });
});

// ─── Layout Block Builders (via buildAllComponentsFromUi) ─────────────────────

describe('buildTextDisplaysFromUi (via buildAllComponentsFromUi)', () => {
  it('throws when content is empty', () => {
    expect(() =>
      buildAllComponentsFromUi([], [], [], [{ content: '' }], [], [], [], [], [], mockNode),
    ).toThrow(NodeOperationError);
  });

  it('builds a text display with the correct type and content', () => {
    const [block] = buildAllComponentsFromUi([], [], [], [{ content: 'Hello!' }], [], [], [], [], [], mockNode);
    expect((block as any).type).toBe(10);
    expect((block as any).content).toBe('Hello!');
  });
});

describe('buildSectionsFromUi (via buildAllComponentsFromUi)', () => {
  it('throws when title is empty', () => {
    expect(() =>
      buildAllComponentsFromUi([], [], [], [], [{ title: '', content: 'body', thumbnailUrl: '' }], [], [], [], [], mockNode),
    ).toThrow(NodeOperationError);
  });

  it('builds a section with type 9', () => {
    const [block] = buildAllComponentsFromUi([], [], [], [], [{ title: 'My Title', content: '', thumbnailUrl: '' }], [], [], [], [], mockNode);
    expect((block as any).type).toBe(9);
  });

  it('includes thumbnail accessory when thumbnailUrl is set', () => {
    const [block] = buildAllComponentsFromUi(
      [], [], [], [],
      [{ title: 'T', content: '', thumbnailUrl: 'https://example.com/img.png' }],
      [], [], [], [], mockNode,
    );
    expect((block as any).accessory).toEqual({ type: 11, media: { url: 'https://example.com/img.png' } });
  });

  it('omits accessory when thumbnailUrl is empty', () => {
    const [block] = buildAllComponentsFromUi([], [], [], [], [{ title: 'T', content: '', thumbnailUrl: '' }], [], [], [], [], mockNode);
    expect((block as any).accessory).toBeUndefined();
  });
});

describe('buildSeparatorsFromUi (via buildAllComponentsFromUi)', () => {
  it('builds a horizontal separator as type 14 with divider:true', () => {
    const [block] = buildAllComponentsFromUi([], [], [], [], [], [{ type: 'horizontal' }], [], [], [], mockNode);
    expect((block as any).type).toBe(14);
    expect((block as any).divider).toBe(true);
  });

  it('builds an emoji separator as a type-10 text display', () => {
    const [block] = buildAllComponentsFromUi([], [], [], [], [], [{ type: 'emoji', emoji: '⭐' }], [], [], [], mockNode);
    expect((block as any).type).toBe(10);
    expect((block as any).content).toBe('⭐');
  });

  it('defaults emoji separator content to ➖ when emoji is empty', () => {
    const [block] = buildAllComponentsFromUi([], [], [], [], [], [{ type: 'emoji', emoji: '' }], [], [], [], mockNode);
    expect((block as any).type).toBe(10);
    expect((block as any).content).toBe('➖');
  });
});

describe('buildContainersFromUi (via buildAllComponentsFromUi)', () => {
  it('throws when title is empty', () => {
    expect(() =>
      buildAllComponentsFromUi([], [], [], [], [], [], [{ title: '', content: '', accentColor: '' }], [], [], mockNode),
    ).toThrow(NodeOperationError);
  });

  it('builds a container with type 17', () => {
    const [block] = buildAllComponentsFromUi([], [], [], [], [], [], [{ title: 'T', content: '', accentColor: '' }], [], [], mockNode);
    expect((block as any).type).toBe(17);
  });

  it('includes accent_color as an integer when accentColor is set', () => {
    const [block] = buildAllComponentsFromUi([], [], [], [], [], [], [{ title: 'T', content: '', accentColor: '#ff0000' }], [], [], mockNode);
    expect((block as any).accent_color).toBe(0xff0000);
  });

  it('omits accent_color when accentColor is empty', () => {
    const [block] = buildAllComponentsFromUi([], [], [], [], [], [], [{ title: 'T', content: '', accentColor: '' }], [], [], mockNode);
    expect((block as any).accent_color).toBeUndefined();
  });
});

describe('buildMediaGalleriesFromUi (via buildAllComponentsFromUi)', () => {
  it('throws when images array is empty', () => {
    expect(() =>
      buildAllComponentsFromUi([], [], [], [], [], [], [], [{ images: [] }], [], mockNode),
    ).toThrow(NodeOperationError);
  });

  it('throws when more than 10 images are provided', () => {
    const images = Array.from({ length: 11 }, (_, i) => `https://example.com/${i}.png`);
    expect(() =>
      buildAllComponentsFromUi([], [], [], [], [], [], [], [{ images }], [], mockNode),
    ).toThrow(NodeOperationError);
  });

  it('builds a media gallery with type 12 and correct items', () => {
    const [block] = buildAllComponentsFromUi(
      [], [], [], [], [], [], [],
      [{ images: ['https://example.com/a.png', 'https://example.com/b.png'] }],
      [], mockNode,
    );
    expect((block as any).type).toBe(12);
    expect((block as any).items).toEqual([
      { media: { url: 'https://example.com/a.png' } },
      { media: { url: 'https://example.com/b.png' } },
    ]);
  });
});

describe('buildFilesFromUi (via buildAllComponentsFromUi)', () => {
  it('throws when fileUrl is empty', () => {
    expect(() =>
      buildAllComponentsFromUi([], [], [], [], [], [], [], [], [{ fileUrl: '', fileName: '' }], mockNode),
    ).toThrow(NodeOperationError);
  });

  it('builds a file component with type 13 and the correct url', () => {
    const [block] = buildAllComponentsFromUi([], [], [], [], [], [], [], [], [{ fileUrl: 'https://cdn.discordapp.com/file.txt', fileName: '' }], mockNode);
    expect((block as any).type).toBe(13);
    expect((block as any).file).toEqual({ url: 'https://cdn.discordapp.com/file.txt' });
  });

  it('includes name when fileName is set', () => {
    const [block] = buildAllComponentsFromUi([], [], [], [], [], [], [], [], [{ fileUrl: 'https://cdn.discordapp.com/file.txt', fileName: 'report.txt' }], mockNode);
    expect((block as any).name).toBe('report.txt');
  });

  it('omits name when fileName is empty', () => {
    const [block] = buildAllComponentsFromUi([], [], [], [], [], [], [], [], [{ fileUrl: 'https://cdn.discordapp.com/file.txt', fileName: '' }], mockNode);
    expect((block as any).name).toBeUndefined();
  });
});

// ─── buildModalFromUi ─────────────────────────────────────────────────────────

function makeModalInput(overrides: Partial<TextInputUiParams> = {}): TextInputUiParams {
  return {
    customId: 'my-input',
    label: 'My Label',
    style: 1,
    placeholder: '',
    value: '',
    minLength: 0,
    maxLength: 0,
    required: true,
    ...overrides,
  };
}

function makeModal(overrides: Partial<ModalUiParams> = {}): ModalUiParams {
  return {
    customId: 'my-modal',
    title: 'My Modal',
    inputs: { input: [makeModalInput()] },
    ...overrides,
  };
}

describe('buildModalFromUi', () => {
  it('throws when customId is empty', () => {
    expect(() => buildModalFromUi(makeModal({ customId: '' }), mockNode)).toThrow(NodeOperationError);
  });

  it('throws when title is empty', () => {
    expect(() => buildModalFromUi(makeModal({ title: '' }), mockNode)).toThrow(NodeOperationError);
  });

  it('throws when title exceeds 45 characters', () => {
    expect(() => buildModalFromUi(makeModal({ title: 'a'.repeat(46) }), mockNode)).toThrow(NodeOperationError);
  });

  it('throws when no inputs are provided', () => {
    expect(() => buildModalFromUi(makeModal({ inputs: { input: [] } }), mockNode)).toThrow(NodeOperationError);
  });

  it('throws when more than 5 inputs are provided', () => {
    const inputs = Array.from({ length: 6 }, (_, i) => makeModalInput({ customId: `input-${i}`, label: `Label ${i}` }));
    expect(() => buildModalFromUi(makeModal({ inputs: { input: inputs } }), mockNode)).toThrow(NodeOperationError);
  });

  it('throws when an input has an empty customId', () => {
    expect(() => buildModalFromUi(makeModal({ inputs: { input: [makeModalInput({ customId: '' })] } }), mockNode)).toThrow(NodeOperationError);
  });

  it('throws when an input has an empty label', () => {
    expect(() => buildModalFromUi(makeModal({ inputs: { input: [makeModalInput({ label: '' })] } }), mockNode)).toThrow(NodeOperationError);
  });

  it('throws when an input label exceeds 45 characters', () => {
    expect(() => buildModalFromUi(makeModal({ inputs: { input: [makeModalInput({ label: 'a'.repeat(46) })] } }), mockNode)).toThrow(NodeOperationError);
  });

  it('throws when an input placeholder exceeds 100 characters', () => {
    expect(() =>
      buildModalFromUi(makeModal({ inputs: { input: [makeModalInput({ placeholder: 'a'.repeat(101) })] } }), mockNode),
    ).toThrow(NodeOperationError);
  });

  it('builds a valid modal object with the expected shape', () => {
    const result = buildModalFromUi(makeModal(), mockNode);
    expect(result).toEqual({
      custom_id: 'my-modal',
      title: 'My Modal',
      components: [
        {
          type: 1,
          components: [
            {
              type: 4,
              custom_id: 'my-input',
              label: 'My Label',
              style: 1,
              required: true,
            },
          ],
        },
      ],
    });
  });

  it('includes placeholder when set', () => {
    const result = buildModalFromUi(makeModal({ inputs: { input: [makeModalInput({ placeholder: 'Enter text' })] } }), mockNode) as any;
    expect(result.components[0].components[0].placeholder).toBe('Enter text');
  });

  it('includes min_length when greater than 0', () => {
    const result = buildModalFromUi(makeModal({ inputs: { input: [makeModalInput({ minLength: 5 })] } }), mockNode) as any;
    expect(result.components[0].components[0].min_length).toBe(5);
  });

  it('includes max_length when greater than 0', () => {
    const result = buildModalFromUi(makeModal({ inputs: { input: [makeModalInput({ maxLength: 200 })] } }), mockNode) as any;
    expect(result.components[0].components[0].max_length).toBe(200);
  });

  it('omits min_length and max_length when 0', () => {
    const result = buildModalFromUi(makeModal(), mockNode) as any;
    expect(result.components[0].components[0].min_length).toBeUndefined();
    expect(result.components[0].components[0].max_length).toBeUndefined();
  });

  it('sets required:false when specified', () => {
    const result = buildModalFromUi(makeModal({ inputs: { input: [makeModalInput({ required: false })] } }), mockNode) as any;
    expect(result.components[0].components[0].required).toBe(false);
  });

  it('sets paragraph style (2) when specified', () => {
    const result = buildModalFromUi(makeModal({ inputs: { input: [makeModalInput({ style: 2 })] } }), mockNode) as any;
    expect(result.components[0].components[0].style).toBe(2);
  });
});
