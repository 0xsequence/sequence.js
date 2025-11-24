export class AnswerIncorrectError extends Error {
  constructor(message: string = 'The provided answer is incorrect.') {
    super(message)
    this.name = 'AnswerIncorrectError'
  }
}

export class ChallengeExpiredError extends Error {
  constructor(message: string = 'The challenge has expired.') {
    super(message)
    this.name = 'ChallengeExpiredError'
  }
}

export class TooManyAttemptsError extends Error {
  constructor(message: string = 'Too many incorrect attempts.') {
    super(message)
    this.name = 'TooManyAttemptsError'
  }
}
