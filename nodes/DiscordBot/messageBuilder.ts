import type { INode } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import type { APIEmbed, APIActionRowComponent } from 'discord.js';

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
 * Build all component action rows from buttons, string selects, and auto selects.
 * Validates that the combined total does not exceed Discord's 5 action row limit.
 */
export function buildAllComponentsFromUi(
  buttons: ButtonUiParams[],
  stringSelects: StringSelectMenuUiParams[],
  autoSelects: AutoSelectMenuUiParams[],
  node: INode,
): APIActionRowComponent<never>[] {
  const buttonRows = buildComponentsFromUi(buttons, node);
  const stringSelectRows = buildStringSelectsFromUi(stringSelects, node);
  const autoSelectRows = buildAutoSelectsFromUi(autoSelects, node);

  const allRows = [...buttonRows, ...stringSelectRows, ...autoSelectRows];

  if (allRows.length > LIMITS.MAX_ACTION_ROWS) {
    throw new NodeOperationError(
      node,
      `Discord allows a maximum of ${LIMITS.MAX_ACTION_ROWS} action rows per message (got ${allRows.length}: ` +
        `${buttonRows.length} button row(s), ${stringSelectRows.length} string select(s), ${autoSelectRows.length} auto-select(s))`,
    );
  }

  return allRows;
}
