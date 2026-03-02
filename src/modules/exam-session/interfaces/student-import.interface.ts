export interface StudentData {
    code: string;
    fullName: string;
    className: string;
    dateOfBirth?: Date;
}

export interface ImportResult {
    student: any;
    status: 'SUCCESS' | 'DUPLICATE' | 'ERROR';
    message?: string;
}
