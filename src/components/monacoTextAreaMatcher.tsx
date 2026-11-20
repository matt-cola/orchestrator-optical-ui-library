import React from 'react';

import type { StoreProviderProps } from '@orchestrator-ui/orchestrator-ui-components';

import { WfoMonacoTextEditor, WfoMonacoTextViewer } from './WfoMonacoText';

type ComponentMatcherExtender = NonNullable<StoreProviderProps['componentMatcherExtender']>;
type ComponentMatcher = Parameters<ComponentMatcherExtender>[0][number];
type ControlledElement = Extract<
  ComponentMatcher['ElementMatch'],
  { isControlledElement: true }
>['Element'];
type ControlledElementProps = React.ComponentProps<ControlledElement>;

/** Id of the matcher of the orchestrator UI rendering `LongText` (`format: long`) fields. */
const TEXTAREA_MATCHER_ID = 'textarea';

/**
 * A `LongText` form field in the Monaco editor: {@link WfoMonacoTextViewer} for a read-only field
 * (`read_only_field(..., merge_type=LongText)`), {@link WfoMonacoTextEditor} otherwise.
 */
export const WfoMonacoTextArea = ({
  pydanticFormField,
  value,
  onChange,
  onBlur,
  disabled,
}: ControlledElementProps) => {
  const text = typeof value === 'string' ? value : (value ?? '').toString();
  const ariaLabel = pydanticFormField.title || pydanticFormField.id;

  return disabled ? (
    <WfoMonacoTextViewer value={text} ariaLabel={ariaLabel} />
  ) : (
    <WfoMonacoTextEditor value={text} onChange={onChange} onBlur={onBlur} ariaLabel={ariaLabel} />
  );
};

/**
 * Render every `LongText` form field with {@link WfoMonacoTextArea} instead of a plain textarea.
 * Pass it to the `StoreProvider` of the orchestrator UI, or call it from your own extender.
 */
export const monacoTextAreaMatcherExtender: ComponentMatcherExtender = (matchers) =>
  matchers.map((matcher) =>
    matcher.id === TEXTAREA_MATCHER_ID
      ? { ...matcher, ElementMatch: { Element: WfoMonacoTextArea, isControlledElement: true } }
      : matcher,
  );
