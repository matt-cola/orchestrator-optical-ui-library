import React, { FC, useCallback, useEffect, useRef, useState } from 'react';

import Editor, { BeforeMount, Monaco, OnMount } from '@monaco-editor/react';

import { useOrchestratorTheme } from '@orchestrator-ui/orchestrator-ui-components';

/**
 * Multi-line text in the Monaco editor, the editor of the step results of the orchestrator UI:
 * line numbers, search (Ctrl+F), next occurrence (Ctrl+D), multiple cursors, ...
 *
 * Two variations:
 *
 * - {@link WfoMonacoTextViewer} shows a text, like a step result;
 * - {@link WfoMonacoTextEditor} edits a text, like a form input.
 */

const THEME_NAME = 'wfoMonacoText';
const LINE_HEIGHT = 19;
const MAX_HEIGHT = 500;
const EDITOR_MIN_LINES = 6;

type EditorInstance = Parameters<OnMount>[0];

/**
 * The editor theme. Monaco has one theme for the whole page, so the background is transparent
 * and each variation paints its own: the viewer the step result background, the editor the
 * form input background.
 */
const useMonacoTheme = () => {
  const { isDarkModeActive } = useOrchestratorTheme();
  const [monaco, setMonaco] = useState<Monaco>();

  const applyTheme = useCallback(
    (instance: Monaco) => {
      instance.editor.defineTheme(THEME_NAME, {
        base: isDarkModeActive ? 'hc-black' : 'vs',
        inherit: true,
        rules: [],
        colors: { 'editor.background': '#00000000' },
      });
      instance.editor.setTheme(THEME_NAME);
    },
    [isDarkModeActive],
  );

  useEffect(() => {
    if (monaco) applyTheme(monaco);
  }, [monaco, applyTheme]);

  const beforeMount: BeforeMount = (instance) => {
    applyTheme(instance);
    setMonaco(instance);
  };
  return beforeMount;
};

/** Grow the editor with its content, between `minHeight` and {@link MAX_HEIGHT}. */
const useContentHeight = (minHeight: number) => {
  const [height, setHeight] = useState(minHeight);
  const onMount = (editor: EditorInstance) => {
    const fit = () =>
      setHeight(Math.min(Math.max(editor.getContentHeight(), minHeight), MAX_HEIGHT));
    editor.onDidContentSizeChange(fit);
    fit();
  };
  return { height, onMount };
};

const useSharedOptions = () => {
  const { theme } = useOrchestratorTheme();
  return {
    lineNumbers: 'on' as const,
    lineHeight: LINE_HEIGHT,
    fontFamily: theme.font.familyCode,
    fontSize: 13,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    automaticLayout: true,
    contextmenu: false,
    wordWrap: 'off' as const,
    tabSize: 4,
  };
};

export type WfoMonacoTextViewerProps = {
  value: string;
  /** Language of the highlighting, `plaintext` by default. */
  language?: string;
  ariaLabel?: string;
};

/** Read-only text, shown like a step result. */
export const WfoMonacoTextViewer: FC<WfoMonacoTextViewerProps> = ({
  value,
  language = 'plaintext',
  ariaLabel,
}) => {
  const { theme, isDarkModeActive } = useOrchestratorTheme();
  const beforeMount = useMonacoTheme();
  const options = useSharedOptions();
  const { height, onMount } = useContentHeight(LINE_HEIGHT);

  return (
    <div
      data-testid="wfo-monaco-text-viewer"
      style={{
        padding: 10,
        borderRadius: theme.border.radius.medium,
        backgroundColor: isDarkModeActive
          ? theme.colors.backgroundBaseNeutral
          : theme.colors.backgroundBaseSubdued,
      }}
    >
      <Editor
        height={height}
        language={language}
        value={value}
        beforeMount={beforeMount}
        onMount={onMount}
        options={{
          ...options,
          readOnly: true,
          domReadOnly: true,
          renderLineHighlight: 'none',
          ariaLabel,
        }}
      />
    </div>
  );
};

export type WfoMonacoTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  /** Language of the highlighting, `plaintext` by default. */
  language?: string;
  /** Text shown while the editor is empty. */
  placeholder?: string;
  ariaLabel?: string;
};

/** Editable text, shown like a form input. */
export const WfoMonacoTextEditor: FC<WfoMonacoTextEditorProps> = ({
  value,
  onChange,
  onBlur,
  language = 'plaintext',
  placeholder,
  ariaLabel,
}) => {
  const { theme } = useOrchestratorTheme();
  const beforeMount = useMonacoTheme();
  const options = useSharedOptions();
  const { height, onMount: fitContent } = useContentHeight(EDITOR_MIN_LINES * LINE_HEIGHT);
  const [focused, setFocused] = useState(false);
  // The editor listeners are registered once: they read the latest onBlur from here.
  const onBlurRef = useRef(onBlur);
  onBlurRef.current = onBlur;

  const onMount: OnMount = (editor) => {
    fitContent(editor);
    editor.onDidFocusEditorText(() => setFocused(true));
    editor.onDidBlurEditorText(() => {
      setFocused(false);
      onBlurRef.current?.();
    });
  };

  return (
    <div
      data-testid="wfo-monaco-text-editor"
      style={{
        padding: '6px 0',
        borderRadius: theme.border.radius.medium,
        backgroundColor: theme.colors.backgroundBasePlain,
        border: `1px solid ${focused ? theme.colors.primary : theme.colors.borderBasePlain}`,
        boxShadow: focused ? `0 0 0 1px ${theme.colors.primary}` : 'none',
      }}
    >
      <Editor
        height={height}
        language={language}
        value={value}
        onChange={(text) => onChange(text ?? '')}
        beforeMount={beforeMount}
        onMount={onMount}
        options={{
          ...options,
          renderLineHighlight: focused ? 'line' : 'none',
          placeholder,
          ariaLabel,
        }}
      />
    </div>
  );
};
