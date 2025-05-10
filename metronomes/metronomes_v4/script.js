// Wait for the HTML document to be fully loaded and parsed
document.addEventListener('DOMContentLoaded', () => {
    // Get references to the main button and the container for metronomes
    const addMetronomeBtn = document.getElementById('addMetronomeBtn');
    const metronomesContainer = document.getElementById('metronomesContainer');

    // Counter to generate unique IDs for each metronome
    let metronomeIdCounter = 0;
    // Object to store references to all active metronome objects (their state and intervals)
    let metronomes = {}; // Using an object for easier lookup by ID

    // --- Web Speech API Check ---
    // Check if Web Speech API is supported and log it.
    // Voices list might populate asynchronously. onvoiceschanged can be used if voice selection is needed.
    if ('speechSynthesis' in window) {
        console.log("Web Speech API (TTS) is supported.");
        // Optional: Pre-warm the voice list, though not strictly necessary for default voice usage.
        window.speechSynthesis.getVoices(); 
        window.speechSynthesis.onvoiceschanged = () => {
            // This event fires when the list of voices is ready/updated.
            // console.log("Speech synthesis voices loaded.");
        };
    } else {
        console.warn("Web Speech API (TTS) is NOT supported. 'Browser TTS' option will not function.");
        // You could disable the "Browser TTS" radio buttons if the API isn't available,
        // but for this example, we'll rely on the user not selecting it or it simply not working.
    }
    // --- End Web Speech API Check ---

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
        // Changed "Google TTS" to "Browser TTS"
        metronomeDiv.innerHTML = `
            <h3>Metronome ${id} <button class="delete-btn">Delete</button></h3>
            
            <div class="sound-options">
                <label>Sound Source:</label>
                <input type="radio" name="soundType${id}" value="custom" checked> Custom File
                <input type="radio" name="soundType${id}" value="browserTTS"> Browser TTS (Current Time)
            </div>

            <div class="file-input-wrapper">
                <label for="soundFile${id}">Upload Sound File:</label>
                <input type="file" id="soundFile${id}" accept="audio/*">
            </div>

            <div>
                <label for="frequencyValue${id}">Frequency:</label>
                <input type="number" id="frequencyValue${id}" value="1" min="0.1" step="any"> <!-- Allow decimals for frequency -->
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
                // If custom sound is selected, show the file input, otherwise hide it.
                if (event.target.value === 'custom') {
                    fileInputWrapper.classList.remove('hidden'); // Show file input
                } else {
                    fileInputWrapper.classList.add('hidden'); // Hide file input for Browser TTS
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
            if (metronomes[id].audioElement && metronomes[id].soundType === 'custom') {
                metronomes[id].audioElement.volume = metronomes[id].volume; // Apply to custom sound player
            }
            // For Browser TTS, volume is applied to the utterance when it's created.
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
            
            // Validate if Browser TTS is chosen but API is not supported
            if (metronomes[id].soundType === 'browserTTS' && !('speechSynthesis' in window)) {
                alert(`Browser TTS (Speech Synthesis) is not supported in your browser. Metronome ${id} cannot start with this option.`);
                return;
            }

            // Get frequency value and unit
            const freqValue = parseFloat(frequencyValueInput.value); // Use parseFloat for decimal frequencies
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

            // Ensure interval is valid (greater than 0)
            if (isNaN(intervalMilliseconds) || intervalMilliseconds <= 0) {
                alert(`Please enter a valid positive frequency for Metronome ${id}.`);
                return;
            }
            
            // Set the metronome as running
            metronomes[id].isRunning = true;
            startBtn.disabled = true; // Disable Start button
            stopBtn.disabled = false; // Enable Stop button
            
            // Play the first sound immediately if desired (optional)
            // playSound(id); // Uncomment if you want the first tick immediately upon start

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

            // If using Web Speech API and it's speaking, you might want to cancel it.
            // window.speechSynthesis.cancel() will cancel ALL speech, which might not be desired
            // if other TTS metronomes are running. For simplicity, we'll let current speech finish.
            // If a metronome is stopped, its interval is cleared, so no new sounds for it will be queued.
        });

        // Event listener for the Delete button
        deleteBtn.addEventListener('click', () => {
            // Stop the metronome if it's running
            if (metronomes[id].isRunning) {
                clearInterval(metronomes[id].intervalId);
                // Similar to stop, not explicitly calling window.speechSynthesis.cancel() here
                // to avoid stopping other TTS metronomes.
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
        if (!metronome || !metronome.isRunning) return; // Safety check: if metronome was deleted or stopped between interval and execution

        if (metronome.soundType === 'custom') {
            // Play custom sound
            if (metronome.audioElement) {
                metronome.audioElement.currentTime = 0; // Rewind to start
                metronome.audioElement.volume = metronome.volume; // Ensure volume is current
                metronome.audioElement.play().catch(error => console.error(`Metronome ${id}: Error playing custom sound:`, error));
            }
        } else if (metronome.soundType === 'browserTTS') {
            // Play current time using Web Speech API
            if ('speechSynthesis' in window) {
                const now = new Date();
                let hours = now.getHours();
                const minutes = now.getMinutes();
                // const ampm = hours >= 12 ? 'PM' : 'AM';
                // hours = hours % 12;
                // hours = hours ? hours : 12; // Convert 0 to 12 for 12 AM/PM

                // Create a more natural-sounding time string
                let timeString = `${hours}:${minutes}`;
                // if (minutes === 0) {
                //     timeString = `${hours} o'clock ${ampm}`;
                // } else if (minutes < 10) {
                //     timeString = `${hours} oh ${minutes} ${ampm}`; // e.g., "10 oh 5 AM"
                // } else {
                //     timeString = `${hours} ${minutes} ${ampm}`; // e.g., "10 35 AM"
                // }
                // Alternative for a simple "tick" sound if time is not desired:
                // const timeString = "tick";

                const utterance = new SpeechSynthesisUtterance(timeString);
                utterance.volume = metronome.volume; // Set volume (0.0 to 1.0)
                
                // Optional: You could try to select a specific voice if desired
                // let voices = window.speechSynthesis.getVoices();
                // if (voices.length > 0) {
                //     utterance.voice = voices.find(voice => voice.lang.startsWith('en')) || voices[0]; // Prefer English
                // }

                utterance.onerror = (event) => {
                    console.error(`Metronome ${id}: SpeechSynthesisUtterance error:`, event.error);
                };
                
                window.speechSynthesis.speak(utterance);
            } else {
                // This case should ideally be caught before starting the metronome,
                // but good to have a fallback log.
                console.warn(`Metronome ${id}: Attempted to use Browser TTS, but API is not supported.`);
            }
        }
    }
});