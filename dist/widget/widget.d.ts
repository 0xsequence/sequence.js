import '@0xsequence/design-system/preset';
import './index.css';
export type AnyPayWidgetProps = {
    sequenceApiKey: string;
    indexerUrl?: string;
    apiUrl?: string;
    env?: 'local' | 'cors-anywhere' | 'dev' | 'prod';
};
export declare const AnyPayWidget: ({ sequenceApiKey, indexerUrl, apiUrl, env, }: AnyPayWidgetProps) => import("react/jsx-runtime").JSX.Element;
export default AnyPayWidget;
//# sourceMappingURL=widget.d.ts.map