-- CreateTable
CREATE TABLE "login_challenges" (
    "id" UUID NOT NULL,
    "challenge_id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "code_hash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "login_challenges_challenge_id_key" ON "login_challenges"("challenge_id");

-- CreateIndex
CREATE INDEX "login_challenges_user_id_idx" ON "login_challenges"("user_id");

-- CreateIndex
CREATE INDEX "login_challenges_expires_at_idx" ON "login_challenges"("expires_at");

-- AddForeignKey
ALTER TABLE "login_challenges" ADD CONSTRAINT "login_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
