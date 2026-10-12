<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('room_participants', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('room_id')->constrained()->restrictOnDelete();
            $table->foreignId('guest_id')->constrained()->restrictOnDelete();
            $table->foreignId('room_link_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name');
            $table->dateTime('hand_raised_at')->nullable();
            $table->dateTime('promoted_at')->nullable();
            $table->dateTime('removed_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['room_id', 'guest_id']);
            $table->index(['room_id', 'hand_raised_at']);
            $table->index(['room_id', 'promoted_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('room_participants');
    }
};
