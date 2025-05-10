// Wait for the HTML document to be fully loaded and parsed
document.addEventListener('DOMContentLoaded', () => {
    // Get references to the main button and the container for metronomes
    const addMetronomeBtn = document.getElementById('addMetronomeBtn');
    const metronomesContainer = document.getElementById('metronomesContainer');

    // Counter to generate unique IDs for each metronome
    let metronomeIdCounter = 0;
    // Array to store references to all active metronome objects (their state and intervals)
    let metronomes = {}; // Using an object for easier lookup by ID

    // Event listener for the "Add New Metronome" button
    addMetronomeBtn.addEventListener('click', createMetronomeUI);

    // Function to create the UI for a new metronome
    function createMetronomeUI() {
        // Increment the counter to get a new unique ID
        metronomeIdCounter++;
        const id = metronomeIdCounter;

        // Create the main div element for this metronome
        const metronomeDiv = document.createElement('div');
        metronomeDiv.classList.add('metronome'); // Add CSS class for styling
        metronomeDiv.setAttribute('data-id', id); // Set a data attribute for easy identification

        // Create the HTML content for the metronome's controls
        metronomeDiv.innerHTML = `
            <h3>Metronome ${id} <button class="delete-btn">Delete</button></h3>
            
            <div class="sound-options">
                <label>Sound Source:</label>
                <input type="radio" name="soundType${id}" value="custom" checked> Custom File
                <input type="radio" name="soundType${id}" value="googleTTS"> Google TTS (Current Time)
            </div>

            <div class="file-input-wrapper">
                <label for="soundFile${id}">Upload Sound File:</label>
                <input type="file" id="soundFile${id}" accept="audio/*">
            </div>

            <div>
                <label for="frequencyValue${id}">Frequency:</label>
                <input type="number" id="frequencyValue${id}" value="1" min="1">
                <select id="frequencyUnit${id}">
                    <option value="seconds" selected>Seconds</option>
                    <option value="minutes">Minutes</option>
                    <option value="custom">Milliseconds</option> 
                </select>
            </div>

            <div>
                <label for="volume${id}">Volume:</label>
                <input type="range" id="volume${id}" min="0" max="1" step="0.01" value="0.8">
            </div>

            <div class="controls">
                <button class="start-btn">Start</button>
                <button class="stop-btn" disabled>Stop</button>
            </div>
        `;

        // Append the new metronome's UI to the container
        metronomesContainer.appendChild(metronomeDiv);

        // Initialize the state for this new metronome
        metronomes[id] = {
            id: id, // The ID of this metronome
            intervalId: null, // To store the ID returned by setInterval, so it can be cleared
            audioElement: null, // To store the <audio> element for custom sounds
            customSoundURL: null, // To store the URL of the uploaded custom sound
            soundType: 'custom', // Default sound type
            isRunning: false, // Flag to indicate if the metronome is currently running
            volume: 0.8 // Default volume
        };

        // Get references to specific elements within this new metronome's UI
        const soundTypeRadios = metronomeDiv.querySelectorAll(`input[name="soundType${id}"]`);
        const fileInputWrapper = metronomeDiv.querySelector('.file-input-wrapper');
        const soundFileInput = metronomeDiv.querySelector(`#soundFile${id}`);
        const frequencyValueInput = metronomeDiv.querySelector(`#frequencyValue${id}`);
        const frequencyUnitSelect = metronomeDiv.querySelector(`#frequencyUnit${id}`);
        const volumeSlider = metronomeDiv.querySelector(`#volume${id}`);
        const startBtn = metronomeDiv.querySelector('.start-btn');
        const stopBtn = metronomeDiv.querySelector('.stop-btn');
        const deleteBtn = metronomeDiv.querySelector('.delete-btn');

        // Add event listeners for the controls of this specific metronome

        // Event listener for sound type selection (radio buttons)
        soundTypeRadios.forEach(radio => {
            radio.addEventListener('change', (event) => {
                metronomes[id].soundType = event.target.value; // Update sound type in the state
                if (event.target.value === 'custom') {
                    fileInputWrapper.classList.remove('hidden'); // Show file input
                } else {
                    fileInputWrapper.classList.add('hidden'); // Hide file input for Google TTS
                }
            });
        });

        // Event listener for custom sound file selection
        soundFileInput.addEventListener('change', (event) => {
            const file = event.target.files[0]; // Get the selected file
            if (file) {
                // Revoke previous object URL if one exists, to free up memory
                if (metronomes[id].customSoundURL) {
                    URL.revokeObjectURL(metronomes[id].customSoundURL);
                }
                // Create an object URL for the selected file
                metronomes[id].customSoundURL = URL.createObjectURL(file);
                // If an audio element already exists for this metronome, update its source
                if (metronomes[id].audioElement) {
                    metronomes[id].audioElement.src = metronomes[id].customSoundURL;
                } else {
                    // Otherwise, create a new audio element
                    metronomes[id].audioElement = new Audio(metronomes[id].customSoundURL);
                }
                metronomes[id].audioElement.volume = metronomes[id].volume; // Set initial volume
            }
        });
        
        // Event listener for volume slider
        volumeSlider.addEventListener('input', (event) => {
            metronomes[id].volume = parseFloat(event.target.value); // Update volume in state
            if (metronomes[id].audioElement) {
                metronomes[id].audioElement.volume = metronomes[id].volume; // Apply to custom sound player
            }
            // For Google TTS, volume is applied when the sound is played each time
        });

        // Event listener for the Start button
        startBtn.addEventListener('click', () => {
            // Check if the metronome is already running
            if (metronomes[id].isRunning) return;

            // Validate sound source for custom sound
            if (metronomes[id].soundType === 'custom' && !metronomes[id].customSoundURL) {
                alert(`Please select a sound file for Metronome ${id}.`);
                return;
            }

            // Get frequency value and unit
            const freqValue = parseInt(frequencyValueInput.value);
            const freqUnit = frequencyUnitSelect.value;
            let intervalMilliseconds;

            // Calculate interval in milliseconds based on unit
            if (freqUnit === 'seconds') {
                intervalMilliseconds = freqValue * 1000;
            } else if (freqUnit === 'minutes') {
                intervalMilliseconds = freqValue * 60 * 1000;
            } else { // custom (milliseconds)
                intervalMilliseconds = freqValue;
            }

            // Ensure interval is valid
            if (isNaN(intervalMilliseconds) || intervalMilliseconds <= 0) {
                alert(`Please enter a valid frequency for Metronome ${id}.`);
                return;
            }
            
            // Set the metronome as running
            metronomes[id].isRunning = true;
            startBtn.disabled = true; // Disable Start button
            stopBtn.disabled = false; // Enable Stop button

            // Start the interval timer
            metronomes[id].intervalId = setInterval(() => {
                playSound(id); // Call function to play the sound
            }, intervalMilliseconds);
        });

        // Event listener for the Stop button
        stopBtn.addEventListener('click', () => {
            // Check if the metronome is actually running
            if (!metronomes[id].isRunning) return;

            // Clear the interval timer
            clearInterval(metronomes[id].intervalId);
            metronomes[id].intervalId = null; // Reset intervalId
            metronomes[id].isRunning = false; // Set as not running
            startBtn.disabled = false; // Enable Start button
            stopBtn.disabled = true; // Disable Stop button
        });

        // Event listener for the Delete button
        deleteBtn.addEventListener('click', () => {
            // Stop the metronome if it's running
            if (metronomes[id].isRunning) {
                clearInterval(metronomes[id].intervalId);
            }
            // Revoke object URL for custom sound to free memory, if it exists
            if (metronomes[id].customSoundURL) {
                URL.revokeObjectURL(metronomes[id].customSoundURL);
            }
            // Remove the metronome's UI from the DOM
            metronomeDiv.remove();
            // Delete the metronome's state from the `metronomes` object
            delete metronomes[id];
        });
    }

    // Function to play the sound for a given metronome ID
    function playSound(id) {
        const metronome = metronomes[id]; // Get the state object for this metronome
        if (!metronome) return; // Safety check: if metronome was deleted

        if (metronome.soundType === 'custom') {
            // Play custom sound
            if (metronome.audioElement) {
                metronome.audioElement.currentTime = 0; // Rewind to start
                metronome.audioElement.volume = metronome.volume; // Ensure volume is current
                metronome.audioElement.play().catch(error => console.error("Error playing custom sound:", error));
            }
        } else if (metronome.soundType === 'googleTTS') {
            // Play current time using Google TTS
            const now = new Date();
            // Format time as "10 hours 35 minutes" or similar for clearer speech
            let hours = now.getHours();
            const minutes = now.getMinutes();
            // const ampm = hours >= 12 ? 'PM' : 'AM';
            // hours = hours % 12;
            // hours = hours ? hours : 12; // the hour '0' should be '12'
            // const timeString = `${hours} ${minutes === 0 ? "o'clock" : minutes} ${ampm}`; // e.g., "10 35 AM"
            const timeString = `${hours}:${minutes}`; // e.g., "10:35"

            // Construct the Google TTS URL
            // Note: This is an unofficial endpoint and might break or be rate-limited.
            const ttsURL = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(timeString)}&tl=ru&client=tw-ob`;
            
            // Create a temporary audio element for TTS
            const ttsAudio = new Audio(ttsURL);
            ttsAudio.volume = metronome.volume; // Set volume
            ttsAudio.play().catch(error => console.error("Error playing TTS:", error));
            // The temporary audio element will be garbage collected after it finishes playing.
        }
    }
});