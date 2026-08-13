import { BubbleMenuIconButton } from '@/advanced-text-editor/components/BubbleMenuIconButton';
import { EditLinkPopover } from '@/advanced-text-editor/components/EditLinkPopover';
import { TurnIntoBlockDropdown } from '@/advanced-text-editor/components/TurnIntoBlockDropdown';
import { useTextBubbleState } from '@/advanced-text-editor/hooks/useTextBubbleState';
import { hasEditorExtension } from '@/advanced-text-editor/utils/hasEditorExtension';
import { styled } from '@linaria/react';
import { type Editor } from '@tiptap/core';
import {
  IconBold,
  IconItalic,
  IconList,
  IconListNumbers,
  IconStrikethrough,
  IconUnderline,
} from 'twenty-ui/icon';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledToolbar = styled.div`
  align-items: center;
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  box-sizing: border-box;
  display: flex;
  flex-shrink: 0;
  gap: 2px;
  padding: ${themeCssVariables.spacing[1]};
  width: 100%;
`;

type AdvancedTextEditorToolbarProps = {
  editor: Editor;
};

/**
 * Always-visible formatting controls, for editors where the selection-triggered
 * TextBubbleMenu is too well hidden — an empty composer otherwise looks like a
 * plain textarea even though the full rich-text extension set is loaded.
 *
 * Deliberately renders the same actions as TextBubbleMenu rather than replacing
 * it: both stay available, and the bubble menu keeps working on selection.
 */
export const AdvancedTextEditorToolbar = ({
  editor,
}: AdvancedTextEditorToolbarProps) => {
  const state = useTextBubbleState(editor);

  const toolbarActions = [
    {
      Icon: IconBold,
      extensionName: 'bold',
      onClick: () => editor.chain().focus().toggleBold().run(),
      isActive: state.isBold,
    },
    {
      Icon: IconItalic,
      extensionName: 'italic',
      onClick: () => editor.chain().focus().toggleItalic().run(),
      isActive: state.isItalic,
    },
    {
      Icon: IconUnderline,
      extensionName: 'underline',
      onClick: () => editor.chain().focus().toggleUnderline().run(),
      isActive: state.isUnderline,
    },
    {
      Icon: IconStrikethrough,
      extensionName: 'strike',
      onClick: () => editor.chain().focus().toggleStrike().run(),
      isActive: state.isStrike,
    },
    {
      Icon: IconList,
      extensionName: 'bulletList',
      onClick: () => editor.chain().focus().wrapInList('bulletList').run(),
      isActive: state.isBulletList,
    },
    {
      Icon: IconListNumbers,
      extensionName: 'orderedList',
      onClick: () => editor.chain().focus().wrapInList('orderedList').run(),
      isActive: state.isOrderedList,
    },
  ].filter(({ extensionName }) => hasEditorExtension(editor, extensionName));

  const hasHeading = hasEditorExtension(editor, 'heading');
  const hasLink = hasEditorExtension(editor, 'link');

  if (toolbarActions.length === 0 && !hasHeading && !hasLink) {
    return null;
  }

  return (
    <StyledToolbar>
      {hasHeading && <TurnIntoBlockDropdown editor={editor} />}
      {toolbarActions.map(({ Icon, onClick, isActive }) => (
        <BubbleMenuIconButton
          key={Icon.name || Icon.displayName || 'unknown'}
          Icon={Icon}
          onClick={onClick}
          isActive={isActive}
        />
      ))}
      {hasLink && <EditLinkPopover defaultValue={state.linkHref} editor={editor} />}
    </StyledToolbar>
  );
};
