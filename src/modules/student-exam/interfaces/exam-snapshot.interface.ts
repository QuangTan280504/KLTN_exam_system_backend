// Snapshot structures sent to frontend (without correct answers)
export interface MCQSnapshotOption {
    id: string; // Original option ID
    text: string;
    display_label: string; // Shuffled label (A, B, C, D)
}

export interface MCQSnapshotQuestion {
    question_id: string; // Unique ID for this snapshot instance
    original_question_id: string; // Original question ID from DB
    content: string;
    cognitive_level: number;
    images?: string[];
    options: MCQSnapshotOption[];
}

export interface SubQuestionSnapshot {
    id: string; // Original sub-question ID
    text: string;
    display_label: string; // Shuffled label (a, b, c, d)
}

export interface GroupSnapshotQuestion {
    question_id: string;
    original_question_id: string;
    content: string;
    cognitive_level: number;
    images?: string[];
    sub_questions: SubQuestionSnapshot[];
}

export interface ShortAnswerSnapshotQuestion {
    question_id: string;
    original_question_id: string;
    content: string;
    cognitive_level: number;
    images?: string[];
}

export interface ExamSnapshot {
    part1_mcq: MCQSnapshotQuestion[];
    part2_group: GroupSnapshotQuestion[];
    part3_short_answer?: ShortAnswerSnapshotQuestion[];
}

// Student answer structures
export interface MCQAnswer {
    question_id: string; // Snapshot question ID
    selected_option_id: string; // Original option ID
}

export interface SubAnswer {
    sub_question_id: string; // Original sub ID
    selected: boolean; // true = Đúng, false = Sai
}

export interface GroupAnswer {
    question_id: string; // Snapshot question ID
    sub_answers: SubAnswer[];
}

export interface ShortAnswerResponse {
    question_id: string; // Snapshot question ID
    answer_text: string; // Câu trả lời tự luận của HS
}

export interface StudentAnswers {
    mcq_answers: MCQAnswer[];
    group_answers: GroupAnswer[];
    short_answers?: ShortAnswerResponse[];
}

// Grading results
export interface GradingResult {
    mcqCorrectCount: number;
    groupCorrectCount: number;
    totalScore: number;
    details: any;
}
