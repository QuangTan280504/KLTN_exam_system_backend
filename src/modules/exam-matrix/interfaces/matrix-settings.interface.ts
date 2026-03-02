export interface MatrixRule {
    pool_id: string;
    count: number;
    cognitive_level?: number;
}

export interface CustomQuestionInput {
    type: "MCQ" | "GROUP" | "SHORT_ANSWER";
    content: string;
    cognitive_level: number;
    data: any; // MCQData | GroupData | ShortAnswerData
}

/** For updating existing fixed questions */
export interface UpdateQuestionInput {
    id: string;
    content: string;
    cognitive_level: number;
    data: any;
}

export interface MatrixSettings {
    mcq_rules: MatrixRule[];
    group_rules: MatrixRule[];
    short_answer_rules?: MatrixRule[];
    fixed_mcq_ids?: string[];
    fixed_group_ids?: string[];
    fixed_short_answer_ids?: string[];
}
