<?php

use App\Http\Controllers\RoomController;
use Illuminate\Support\Facades\Route;

// No public landing page: the host goes to their rooms (guests hit the login
// page), and attendees arrive through /r/{slug} links.
Route::redirect('/', '/rooms')->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::resource('rooms', RoomController::class)->except('show');
});

require __DIR__.'/settings.php';
