import type { INode } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import type { APIEmbed, APIActionRowComponent, APIMessageTopLevelComponent } from 'discord.js';

// ─── UI Parameter Shapes ─────────────────────────────────────────────────────

export interface EmbedFieldUiParams {
  name: string;
  value: string;
  inline: boolean;
}

export interface EmbedUiParams {
  title?: string;
  description?: string;
  url?: string;
  color?: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  footerText?: string;
  footerIconUrl?: string;
  authorName?: string;
  authorUrl?: string;
  authorIconUrl?: string;
  timestamp?: string;
  embedFields?: {
    field?: EmbedFieldUiParams[];
  };
}

export interface ButtonUiParams {
  label: string;
  style: 1 | 2 | 3 | 4 | 5;
  customId: string;
  url: string;
  disabled: boolean;
  emojiName?: string;
  emojiId?: string;
  emojiAnimated?: boolean;
}

/** New Layout Block UI Parameters */

export interface TextDisplayUiParams {
  content: string;
}

export interface SectionUiParams {
  title: string;
  content: string;
  thumbnailUrl?: string;
}

export interface SeparatorUiParams {
  type: 'horizontal' | 'emoji';
  emoji?: string;
}

export interface ContainerUiParams {
  title: string;
  content: string;
  accentColor?: string;
}

export interface MediaGalleryUiParams {
  images: string[];
}

export interface FileUiParams {
  fileUrl: string;
  fileName: string;
}

// ─── Select Menu Shapes ───────────────────────────────────────────────────────

export interface StringSelectOptionUiParams {
  label: string;
  value: string;
  description: string;
  default: boolean;
  emojiName: string;
  emojiId: string;
  emojiAnimated: boolean;
}

export interface StringSelectMenuUiParams {
  customId: string;
  disabled: boolean;
  maxValues: number;
  minValues: number;
  placeholder: string;
  selectOptions: { option?: StringSelectOptionUiParams[] };
}

/** Discord component type values for auto-populated select menus */
export type AutoSelectDiscordType = 5 | 6 | 7 | 8;

export interface AutoSelectMenuUiParams {
  /** Channel Types filter — only used when selectType is 8 (Channel Select) */
  channelTypes: number[];
  customId: string;
  disabled: boolean;
  maxValues: number;
  minValues: number;
  placeholder: string;
  selectType: AutoSelectDiscordType;
}

// ─── Discord Limits ───────────────────────────────────────────────────────────

const LIMITS = {
  MAX_EMBEDS: 10,
  MAX_EMBED_FIELDS: 25,
  TITLE_MAX: 256,
  DESCRIPTION_MAX: 4096,
  FIELD_NAME_MAX: 256,
  FIELD_VALUE_MAX: 1024,
  FOOTER_TEXT_MAX: 2048,
  AUTHOR_NAME_MAX: 256,
  MAX_BUTTONS: 25,
  BUTTONS_PER_ROW: 5,
  MAX_ACTION_ROWS: 5,
  MAX_SELECT_OPTIONS: 25,
} as const;

// ─── Color Parsing ────────────────────────────────────────────────────────────

/**
 * Convert a hex color string (with or without leading #) to a Discord integer.
 * Returns undefined for empty input. Throws NodeOperationError for invalid hex.
 */
export function parseEmbedColor(value: string, node: INode): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const normalized = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    throw new NodeOperationError(node, 'Embed Color must be a 6-digit hex value like #5865F2');
  }

  return parseInt(normalized, 16);
}

// ─── Embed Builder ────────────────────────────────────────────────────────────

function checkLength(value: string, max: number, label: string, node: INode): void {
  if (value.length > max) {
    throw new NodeOperationError(
      node,
      `${label} exceeds Discord's limit of ${max} characters (got ${value.length})`,
    );
  }
}

/**
 * Build a Discord-compatible embeds array from the UI parameter shape.
 * Empty string fields are omitted from the output. Validates Discord limits.
 */
export function buildEmbedsFromUi(embeds: EmbedUiParams[], node: INode): APIEmbed[] {
  if (embeds.length > LIMITS.MAX_EMBEDS) {
    throw new NodeOperationError(
      node,
      `Discord allows a maximum of ${LIMITS.MAX_EMBEDS} embeds per message (got ${embeds.length})`,
    );
  }

  return embeds.map((embed) => {
    const result: APIEmbed = {};

    if (embed.title) {
      checkLength(embed.title, LIMITS.TITLE_MAX, 'Embed Title', node);
      result.title = embed.title;
    }

    if (embed.description) {
      checkLength(embed.description, LIMITS.DESCRIPTION_MAX, 'Embed Description', node);
      result.description = embed.description;
    }

    if (embed.url) {
      result.url = embed.url;
    }

    if (embed.color) {
      result.color = parseEmbedColor(embed.color, node);
    }

    if (embed.thumbnailUrl) {
      result.thumbnail = { url: embed.thumbnailUrl };
    }

    if (embed.imageUrl) {
      result.image = { url: embed.imageUrl };
    }

    if (embed.footerText) {
      checkLength(embed.footerText, LIMITS.FOOTER_TEXT_MAX, 'Footer Text', node);
      result.footer = {
        text: embed.footerText,
        ...(embed.footerIconUrl ? { icon_url: embed.footerIconUrl } : {}),
      };
    }

    if (embed.authorName) {
      checkLength(embed.authorName, LIMITS.AUTHOR_NAME_MAX, 'Author Name', node);
      result.author = {
        name: embed.authorName,
        ...(embed.authorUrl ? { url: embed.authorUrl } : {}),
        ...(embed.authorIconUrl ? { icon_url: embed.authorIconUrl } : {}),
      };
    }

    if (embed.timestamp) {
      result.timestamp = embed.timestamp;
    }

    const fieldItems = embed.embedFields?.field ?? [];
    if (fieldItems.length > LIMITS.MAX_EMBED_FIELDS) {
      throw new NodeOperationError(
        node,
        `Discord allows a maximum of ${LIMITS.MAX_EMBED_FIELDS} fields per embed (got ${fieldItems.length})`,
      );
    }

    if (fieldItems.length > 0) {
      result.fields = fieldItems.map((f) => {
        checkLength(f.name, LIMITS.FIELD_NAME_MAX, 'Embed Field Name', node);
        checkLength(f.value, LIMITS.FIELD_VALUE_MAX, 'Embed Field Value', node);
        return {
          name: f.name,
          value: f.value,
          inline: f.inline ?? false,
        };
      });
    }

    return result;
  });
}

// ─── Component Builder ────────────────────────────────────────────────────────

/**
 * Build Discord action rows containing buttons from the UI parameter shape.
 * Buttons are auto-grouped into rows of up to 5. Validates Discord limits and
 * link vs non-link button rules.
 */
export function buildComponentsFromUi(
  buttons: ButtonUiParams[],
  node: INode,
): APIActionRowComponent<never>[] {
  if (buttons.length > LIMITS.MAX_BUTTONS) {
    throw new NodeOperationError(
      node,
      `Discord allows a maximum of ${LIMITS.MAX_BUTTONS} buttons per message (got ${buttons.length})`,
    );
  }

  for (const button of buttons) {
    if (button.style === 5) {
      if (!button.url?.trim()) {
        throw new NodeOperationError(
          node,
          `Link button "${button.label}" requires a URL. Set the URL field or change the style.`,
        );
      }
    } else {
      if (!button.customId?.trim()) {
        throw new NodeOperationError(
          node,
          `Non-link button "${button.label}" requires a Custom ID. Set the Custom ID field or change the style to Link.`,
        );
      }
    }
  }

  const rows: APIActionRowComponent<never>[] = [];

  for (let i = 0; i < buttons.length; i += LIMITS.BUTTONS_PER_ROW) {
    const chunk = buttons.slice(i, i + LIMITS.BUTTONS_PER_ROW);

    const rowComponents = chunk.map((button) => {
      const component: Record<string, unknown> = {
        type: 2,
        style: button.style,
        label: button.label,
      };

      if (button.disabled) {
        component.disabled = true;
      }

      if (button.style === 5) {
        component.url = button.url;
      } else {
        component.custom_id = button.customId;
      }

      if (button.emojiName || button.emojiId) {
        component.emoji = {
          ...(button.emojiName ? { name: button.emojiName } : {}),
          ...(button.emojiId ? { id: button.emojiId } : {}),
          ...(button.emojiAnimated !== undefined ? { animated: button.emojiAnimated } : {}),
        };
      }

      return component;
    });

    rows.push({
      type: 1,
      components: rowComponents,
    } as unknown as APIActionRowComponent<never>);
  }

  return rows;
}

// ─── Select Menu Builders ─────────────────────────────────────────────────────

/**
 * Build Discord action rows containing string select menus (type 3).
 * Each select menu occupies its own action row.
 */
export function buildStringSelectsFromUi(
  selects: StringSelectMenuUiParams[],
  node: INode,
): APIActionRowComponent<never>[] {
  return selects.map((select) => {
    if (!select.customId?.trim()) {
      throw new NodeOperationError(node, 'String Select Menu requires a Custom ID');
    }

    const options = select.selectOptions?.option ?? [];
    if (options.length === 0) {
      throw new NodeOperationError(
        node,
        `String Select Menu "${select.customId}" requires at least one option`,
      );
    }
    if (options.length > LIMITS.MAX_SELECT_OPTIONS) {
      throw new NodeOperationError(
        node,
        `String Select Menu "${select.customId}" exceeds the maximum of ${LIMITS.MAX_SELECT_OPTIONS} options (got ${options.length})`,
      );
    }

    const component: Record<string, unknown> = {
      type: 3,
      custom_id: select.customId,
      options: options.map((opt) => {
        const o: Record<string, unknown> = { label: opt.label, value: opt.value };
        if (opt.description) o.description = opt.description;
        if (opt.default) o.default = true;
        if (opt.emojiName || opt.emojiId) {
          o.emoji = {
            ...(opt.emojiName ? { name: opt.emojiName } : {}),
            ...(opt.emojiId ? { id: opt.emojiId } : {}),
            ...(opt.emojiAnimated ? { animated: opt.emojiAnimated } : {}),
          };
        }
        return o;
      }),
    };

    if (select.placeholder) component.placeholder = select.placeholder;
    if (select.minValues !== 1) component.min_values = select.minValues;
    if (select.maxValues !== 1) component.max_values = select.maxValues;
    if (select.disabled) component.disabled = true;

    return { type: 1, components: [component] } as unknown as APIActionRowComponent<never>;
  });
}

/**
 * Build Discord action rows for auto-populated select menus:
 * User Select (5), Role Select (6), Mentionable Select (7), Channel Select (8).
 * Each select menu occupies its own action row.
 */
export function buildAutoSelectsFromUi(
  selects: AutoSelectMenuUiParams[],
  node: INode,
): APIActionRowComponent<never>[] {
  return selects.map((select) => {
    if (!select.customId?.trim()) {
      throw new NodeOperationError(node, 'Auto Select Menu requires a Custom ID');
    }

    const component: Record<string, unknown> = {
      type: select.selectType,
      custom_id: select.customId,
    };

    if (select.placeholder) component.placeholder = select.placeholder;
    if (select.minValues !== 1) component.min_values = select.minValues;
    if (select.maxValues !== 1) component.max_values = select.maxValues;
    if (select.disabled) component.disabled = true;

    if (select.selectType === 8 && Array.isArray(select.channelTypes) && select.channelTypes.length > 0) {
      component.channel_types = select.channelTypes;
    }

    return { type: 1, components: [component] } as unknown as APIActionRowComponent<never>;
  });
}

/**
 * Build all Discord message components from buttons, select menus, and layout blocks.
 * Validates that the combined action rows do not exceed Discord's 5 action row limit.
 */
export function buildAllComponentsFromUi(
  buttons: ButtonUiParams[],
  stringSelects: StringSelectMenuUiParams[],
  autoSelects: AutoSelectMenuUiParams[],
  textDisplays: TextDisplayUiParams[],
  sections: SectionUiParams[],
  separators: SeparatorUiParams[],
  containers: ContainerUiParams[],
  mediaGalleries: MediaGalleryUiParams[],
  files: FileUiParams[],
  node: INode,
): APIMessageTopLevelComponent[] {
  const buttonRows = buildComponentsFromUi(buttons, node);
  const stringSelectRows = buildStringSelectsFromUi(stringSelects, node);
  const autoSelectRows = buildAutoSelectsFromUi(autoSelects, node);
  const textDisplayComponents = buildTextDisplaysFromUi(textDisplays, node);
  const sectionComponents = buildSectionsFromUi(sections, node);
  const separatorComponents = buildSeparatorsFromUi(separators, node);
  const containerComponents = buildContainersFromUi(containers, node);
  const mediaGalleryComponents = buildMediaGalleriesFromUi(mediaGalleries, node);
  const fileComponents = buildFilesFromUi(files, node);

  const allRows = [...buttonRows, ...stringSelectRows, ...autoSelectRows];

  if (allRows.length > LIMITS.MAX_ACTION_ROWS) {
    throw new NodeOperationError(
      node,
      `Discord allows a maximum of ${LIMITS.MAX_ACTION_ROWS} action rows per message (got ${allRows.length}: ` +
        `${buttonRows.length} button row(s), ${stringSelectRows.length} string select(s), ${autoSelectRows.length} auto-select(s))`,
    );
  }

  return [
    ...allRows,
    ...textDisplayComponents,
    ...sectionComponents,
    ...separatorComponents,
    ...containerComponents,
    ...mediaGalleryComponents,
    ...fileComponents,
  ];
}

// ─── Layout Block Builders ─────────────────────────────────────────────────────

export interface TextInputUiParams {
  customId: string;
  label: string;
  style: 1 | 2;
  placeholder: string;
  value: string;
  minLength: number;
  maxLength: number;
  required: boolean;
}

export interface ModalUiParams {
  customId: string;
  title: string;
  inputs: { input?: TextInputUiParams[] };
}

const MODAL_LIMITS = {
  MAX_INPUTS: 5,
  TITLE_MAX: 45,
  LABEL_MAX: 45,
  PLACEHOLDER_MAX: 100,
} as const;

/**
 * Build a Discord-compatible modal object from the UI parameter shape.
 * Returns a raw API object suitable for use as the `data` field of an
 * interaction callback with type 9 (MODAL).
 */
export function buildModalFromUi(modal: ModalUiParams, node: INode): object {
  if (!modal.customId?.trim()) {
    throw new NodeOperationError(node, 'Modal requires a Custom ID');
  }
  if (!modal.title?.trim()) {
    throw new NodeOperationError(node, 'Modal requires a Title');
  }
  checkLength(modal.title, MODAL_LIMITS.TITLE_MAX, 'Modal Title', node);

  const inputs = modal.inputs?.input ?? [];
  if (inputs.length === 0) {
    throw new NodeOperationError(node, 'Modal requires at least one Text Input');
  }
  if (inputs.length > MODAL_LIMITS.MAX_INPUTS) {
    throw new NodeOperationError(
      node,
      `Discord allows a maximum of ${MODAL_LIMITS.MAX_INPUTS} text inputs per modal (got ${inputs.length})`,
    );
  }

  const components = inputs.map((input) => {
    if (!input.customId?.trim()) {
      throw new NodeOperationError(node, 'Each Text Input requires a Custom ID');
    }
    if (!input.label?.trim()) {
      throw new NodeOperationError(node, 'Each Text Input requires a Label');
    }
    checkLength(input.label, MODAL_LIMITS.LABEL_MAX, 'Text Input Label', node);
    if (input.placeholder) {
      checkLength(input.placeholder, MODAL_LIMITS.PLACEHOLDER_MAX, 'Text Input Placeholder', node);
    }

    const textInput: Record<string, unknown> = {
      type: 4,
      custom_id: input.customId,
      label: input.label,
      style: input.style ?? 1,
      required: input.required ?? true,
    };

    if (input.placeholder) textInput.placeholder = input.placeholder;
    if (input.value) textInput.value = input.value;
    if (input.minLength > 0) textInput.min_length = input.minLength;
    if (input.maxLength > 0) textInput.max_length = input.maxLength;

    return { type: 1, components: [textInput] };
  });

  return {
    custom_id: modal.customId,
    title: modal.title,
    components,
  };
}

/**
 * Build a Discord-compatible TextDisplay component.
 */
function buildTextDisplaysFromUi(textDisplays: TextDisplayUiParams[], node: INode): APIMessageTopLevelComponent[] {
  return textDisplays.map((display) => {
    if (!display.content?.trim()) {
      throw new NodeOperationError(node, 'Text Display requires content');
    }

    return {
      type: 10,
      content: display.content,
    } as APIMessageTopLevelComponent;
  });
}

/**
 * Build a Discord-compatible Section component.
 */
function buildSectionsFromUi(sections: SectionUiParams[], node: INode): APIMessageTopLevelComponent[] {
  return sections.map((section) => {
    if (!section.title?.trim()) {
      throw new NodeOperationError(node, 'Section requires a Title');
    }

    const components: Array<Record<string, unknown>> = [
      {
        type: 10,
        content: section.title,
      },
    ];

    if (section.content?.trim()) {
      components.push({
        type: 10,
        content: section.content,
      });
    }

    const result: Record<string, unknown> = {
      type: 9,
      components,
    };

    if (section.thumbnailUrl?.trim()) {
      result.accessory = {
        type: 11,
        media: {
          url: section.thumbnailUrl,
        },
      };
    }

    return result as unknown as APIMessageTopLevelComponent;
  });
}

/**
 * Build a Discord-compatible Separator component.
 */
function buildSeparatorsFromUi(separators: SeparatorUiParams[], node: INode): APIMessageTopLevelComponent[] {
  return separators.map((separator) => {
    if (separator.type === 'emoji') {
      const emojiText = separator.emoji?.trim() || '➖';
      return {
        type: 10,
        content: emojiText,
      } as APIMessageTopLevelComponent;
    }

    return {
      type: 14,
      divider: true,
      spacing: 1,
    } as APIMessageTopLevelComponent;
  });
}

/**
 * Build a Discord-compatible Container component.
 */
function buildContainersFromUi(containers: ContainerUiParams[], node: INode): APIMessageTopLevelComponent[] {
  return containers.map((container) => {
    if (!container.title?.trim()) {
      throw new NodeOperationError(node, 'Container requires a Title');
    }

    const result: Record<string, unknown> = {
      type: 17,
      components: [
        {
          type: 10,
          content: `${container.title}${container.content ? `\n${container.content}` : ''}`,
        },
      ],
    };

    if (container.accentColor?.trim()) {
      result.accent_color = parseEmbedColor(container.accentColor, node);
    }

    return result as unknown as APIMessageTopLevelComponent;
  });
}

/**
 * Build a Discord-compatible Media Gallery component.
 */
function buildMediaGalleriesFromUi(mediaGalleries: MediaGalleryUiParams[], node: INode): APIMessageTopLevelComponent[] {
  return mediaGalleries.map((gallery) => {
    const images = gallery.images ?? [];
    if (images.length === 0) {
      throw new NodeOperationError(node, 'Media Gallery requires at least one image URL');
    }
    if (images.length > 10) {
      throw new NodeOperationError(node, 'Media Gallery supports up to 10 images');
    }

    return {
      type: 12,
      items: images.map((url) => ({
        media: { url },
      })),
    } as APIMessageTopLevelComponent;
  });
}

/**
 * Build a Discord-compatible File component.
 */
function buildFilesFromUi(files: FileUiParams[], node: INode): APIMessageTopLevelComponent[] {
  return files.map((file) => {
    if (!file.fileUrl?.trim()) {
      throw new NodeOperationError(node, 'File requires a URL');
    }

    const result: Record<string, unknown> = {
      type: 13,
      file: {
        url: file.fileUrl,
      },
    };

    if (file.fileName?.trim()) {
      result.name = file.fileName.trim();
    }

    return result as unknown as APIMessageTopLevelComponent;
  });
}
