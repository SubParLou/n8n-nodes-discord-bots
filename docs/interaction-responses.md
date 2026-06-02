# Interaction Responses

[&larr; Back to README](../README.md)

The **Respond to Interaction** operation sends a response to a Discord slash command, button, select menu, context menu command, or modal interaction.

Interactions must be responded to within **3 seconds**, or within **15 minutes** if the trigger had **Auto Acknowledge Interactions** enabled.

## Parameters

| Parameter | Description |
|-----------|-------------|
| **Use Interaction Data From Input** | When enabled *(default)*, reads `interactionId` and `interactionToken` automatically from the incoming item. Disable to enter them manually. |
| Interaction ID | `{{$json.interactionId}}` - only shown when *Use Interaction Data From Input* is off |
| Interaction Token | `{{$json.interactionToken}}` - only shown when *Use Interaction Data From Input* is off |
| Content | Plain text response body |
| **Message Payload Mode** | Controls how embeds and components are built - same three modes as Send Message (Builder, Raw JSON, Builder + Advanced JSON Merge). See [Messaging Operations](messaging-operations.md) for full details. |
| Reply Embeds | Visual embed builder (Builder and Builder + Advanced JSON Merge modes). Full field support: title, description, color, footer, author, thumbnail, image, embed fields, timestamp. |
| Embeds JSON | Raw JSON array of embed objects (Raw JSON and Builder + Advanced JSON Merge modes) |
| Reply Components | Visual button builder (Builder and Builder + Advanced JSON Merge modes). Buttons are auto-grouped into rows of 5. |
| String Select Menus | Dropdown menus with custom options (Builder and Builder + Advanced JSON Merge modes). Same fields as in Send Message. |
| Auto-Populated Select Menus | User/Role/Mentionable/Channel selects (Builder and Builder + Advanced JSON Merge modes). |
| Components JSON | Raw JSON array of action row component objects (Raw JSON and Builder + Advanced JSON Merge modes) |
| Ephemeral | When true, the response is only visible to the user who triggered the interaction |

## Output

`{ operation, interactionId, responded: true, responseType: 'initial' | 'follow-up' }`

`responseType` is `'initial'` when the interaction has not yet been acknowledged, or `'follow-up'` when the trigger used auto-acknowledge and this node is sending the deferred follow-up.

## Notes

- The node automatically detects whether to use `reply()` or `followUp()` based on acknowledgement state.
- If the trigger has **Auto Acknowledge Interactions** enabled, the 3-second window is extended to 15 minutes and this operation sends a follow-up edit to the deferred response.
- Use **Ephemeral** to send a response only visible to the user who triggered the interaction.
