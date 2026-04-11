export type AnalogyLogLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export const ANALOGY_LOG_LEVEL: Record<AnalogyLogLevel, string> = {
    0: "Unknown",
    1: "Trace",
    2: "Verbose",
    3: "Debug",
    4: "Information",
    5: "Warning",
    6: "Error",
    7: "Critical",
    8: "Analogy",
    9: "None",
};

export type AnalogyRowTextType = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const ANALOGY_ROW_TEXT_TYPE: Record<AnalogyRowTextType, string> = {
    0: "None",
    1: "Unknown",
    2: "PlainText",
    3: "RichText",
    4: "JSON",
    5: "XML",
    6: "HTML",
    7: "Markdown",
};

export type AnalogyLogMessage = {
    text: string;
    category: string;
    source: string;
    module: string;
    methodName: string;
    fileName: string;
    level: AnalogyLogLevel;
    date: string;
    id: string;
    processId: number;
    threadId: number;
    lineNumber: number;
    machineName: string;
    user: string;
    parameters: string;
    rawText: string;
    rawTextType: AnalogyRowTextType | string;
    isPartOfMultilineMessage: boolean;
    additionalInformation: Record<string, string> | null;
};
