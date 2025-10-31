export class AnswerIncorrectError extends Error {
    constructor(message = 'The provided answer is incorrect.') {
        super(message);
        this.name = 'AnswerIncorrectError';
    }
}
export class ChallengeExpiredError extends Error {
    constructor(message = 'The challenge has expired.') {
        super(message);
        this.name = 'ChallengeExpiredError';
    }
}
export class TooManyAttemptsError extends Error {
    constructor(message = 'Too many incorrect attempts.') {
        super(message);
        this.name = 'TooManyAttemptsError';
    }
}
