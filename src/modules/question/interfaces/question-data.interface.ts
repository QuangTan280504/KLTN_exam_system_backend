export enum QuestionType {
    MCQ = "MCQ",
    GROUP = "GROUP",
    SHORT_ANSWER = "SHORT_ANSWER",
}

export enum CognitiveLevel {
    BIET = 1,
    HIEU = 2,
    VAN_DUNG = 3,
}

// MCQ Question Data Structure
export interface MCQOption {
    id: string;
    text: string;
    label: string; // A, B, C, D
}

export interface MCQData {
    options: MCQOption[];
    correct_option_id: string;
}

// Group True/False Question Data Structure
export interface SubQuestion {
    id: string;
    text: string;
    label: string; // a, b, c, d
    is_correct: boolean;
}

export interface GroupData {
    sub_questions: SubQuestion[];
}

// Short Answer Question Data Structure
export interface ShortAnswerData {
    sample_answer?: string; // Đáp án mẫu (GV tham khảo khi chấm)
}
