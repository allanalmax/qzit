"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuizStore = exports.QUIZ_STORE = void 0;
const common_1 = require("@nestjs/common");
exports.QUIZ_STORE = Symbol('QUIZ_STORE');
let QuizStore = class QuizStore {
    quizzes = new Map();
    create(quiz) {
        this.quizzes.set(quiz.id, quiz);
        return quiz;
    }
    findById(id) {
        return this.quizzes.get(id);
    }
    async findByIdAsync(id) {
        return this.quizzes.get(id);
    }
    findByJoinCode(joinCode) {
        return Array.from(this.quizzes.values()).find((quiz) => quiz.joinCode === joinCode);
    }
    update(quiz) {
        this.quizzes.set(quiz.id, quiz);
        return quiz;
    }
    values() {
        return this.quizzes.values();
    }
    async findByHostId(hostId) {
        return Array.from(this.quizzes.values()).filter((q) => q.hostId === hostId);
    }
};
exports.QuizStore = QuizStore;
exports.QuizStore = QuizStore = __decorate([
    (0, common_1.Injectable)()
], QuizStore);
//# sourceMappingURL=quiz.store.js.map