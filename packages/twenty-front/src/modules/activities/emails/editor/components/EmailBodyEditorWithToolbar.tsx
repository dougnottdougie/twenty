import { AdvancedTextEditor } from '@/advanced-text-editor/components/AdvancedTextEditor';
import { AdvancedTextEditorToolbar } from '@/advanced-text-editor/components/AdvancedTextEditorToolbar';
import { type AdvancedTextEditorComponentProps } from '@/advanced-text-editor/types/AdvancedTextEditorComponentProps';
import { styled } from '@linaria/react';

const StyledEmailBodyEditorContainer = styled.div`
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  min-height: 0;
  width: 100%;
`;

/**
 * Email body editor with a persistent formatting toolbar.
 *
 * Passed to FormAdvancedTextFieldInput as its EditorComponent, which is the
 * supported seam for this — no change to AdvancedTextEditor itself, so the
 * shared editor keeps behaving identically everywhere else it is used.
 */
export const EmailBodyEditorWithToolbar = ({
  editor,
  readonly,
  minHeight,
}: AdvancedTextEditorComponentProps) => (
  <StyledEmailBodyEditorContainer>
    {readonly !== true && <AdvancedTextEditorToolbar editor={editor} />}
    <AdvancedTextEditor
      editor={editor}
      readonly={readonly}
      minHeight={minHeight}
    />
  </StyledEmailBodyEditorContainer>
);
