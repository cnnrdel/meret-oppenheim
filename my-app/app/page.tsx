'use client';

 import { useState, useEffect, useRef, useCallback } from 'react';
 import { Button } from '@/components/ui/button';
 import { Card } from '@/components/ui/card';
 // Removed Tabs imports as they are not used in the provided JSX
 import { Loader2, Info, Volume2, Camera } from 'lucide-react'; // Keep Volume2 for Audio Player card

 import * as tmImage from '@teachablemachine/image';

 // --- Configuration ---
 const MODEL_URL = '/tm-my-image-model/model.json';
 const METADATA_URL = '/tm-my-image-model/metadata.json';
 const CONFIDENCE_THRESHOLD = 0.7;
 const GESTURE_HOLD_DURATION = 3000; // <<< Time in milliseconds (3 seconds)

 // --- Define Audio Paths (Using the paths from your provided code) ---
 const AUDIO_PATHS: Record<string, string> = {
   lifting: '/audio/lifting.mp3',
   stirring: '/audio/stirring.mp3',
   resting: '/audio/resting.mp3',
   tilting: '/audio/tilting.mp3',
 };

 // Define which gestures should trigger audio (Using the gestures from your provided code)
 const TRIGGERABLE_GESTURES = new Set(['lifting', 'stirring', 'resting', 'tilting']);

 export default function Home() {
   const webcamRef = useRef<HTMLVideoElement>(null);
   const audioPlayerRef = useRef<HTMLAudioElement | null>(null); // Keep as per provided code
   const lastPlayedTimeRef = useRef<number>(0);
   const lastGestureRef = useRef<string>('None');
   const hasInteractedRef = useRef<boolean>(false);
   const modelRef = useRef<tmImage.CustomMobileNet | null>(null);
   const animationFrameIdRef = useRef<number | null>(null);
   const audioElementsRef = useRef<Record<string, HTMLAudioElement>>({});

   // --- Refs for Hold Detection ---
   const gestureStartTimeRef = useRef<number | null>(null);
   const currentTrackedGestureRef = useRef<string | null>(null);
   const triggerTimeoutRef = useRef<NodeJS.Timeout | null>(null);
   // --- End Refs for Hold Detection ---


   const [isDetecting, setIsDetecting] = useState(false);
   const [isLoading, setIsLoading] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [detectedGesture, setDetectedGesture] = useState('None');
   const [confidence, setConfidence] = useState(0);
   const [modelStatus, setModelStatus] = useState('Loading Teachable Machine model...');
   const [labels, setLabels] = useState<string[]>([]);


   // Load Teachable Machine model and Preload Audio
   useEffect(() => {
     async function loadModelAndAudio() { // Combined function
       try {
         setModelStatus('Loading model...');
         const model = await tmImage.load(MODEL_URL, METADATA_URL);
         modelRef.current = model;
         const modelLabels = model.getClassLabels();
         setLabels(modelLabels);
         setModelStatus('Model loaded successfully!');

         // --- Preload Audio ---
         const initialElements: Record<string, HTMLAudioElement> = {};
         modelLabels.forEach((label) => {
           const labelLower = label.toLowerCase();
           if (TRIGGERABLE_GESTURES.has(labelLower) && AUDIO_PATHS[labelLower]) {
             const audioPath = AUDIO_PATHS[labelLower];
             const audioElement = new Audio(audioPath);
             audioElement.preload = 'auto';
             audioElement.load();
             initialElements[label] = audioElement; // Use original label case as key
             console.log(`Preloading audio for: ${label} from ${audioPath}`);
           }
         });
         audioElementsRef.current = initialElements;
         // --- End Audio Preloading ---

       } catch (err: any) {
         console.error('Failed to load model or audio:', err);
         setModelStatus('Failed to load model.');
         setError('Could not load the gesture detection model. Check console for details.');
         setIsLoading(false);
       }
     }

     loadModelAndAudio();

     // Cleanup function
     return () => {
        // Clear any pending timeout when component unmounts
        if (triggerTimeoutRef.current) {
            clearTimeout(triggerTimeoutRef.current);
        }
     };
   }, []);


   // Function to clear the gesture hold timer and reset tracking refs
   const clearGestureHoldTimer = useCallback(() => {
        if (triggerTimeoutRef.current) {
            clearTimeout(triggerTimeoutRef.current);
            triggerTimeoutRef.current = null;
            // console.log("Hold timer cleared.");
        }
        currentTrackedGestureRef.current = null;
        gestureStartTimeRef.current = null;
   }, []); // No dependencies, safe to memoize


   const handleStartDetection = () => {
     setError(null);
     setIsLoading(true);
     setIsDetecting(true);
     hasInteractedRef.current = true;
   };

   const stopDetection = () => {
     setIsDetecting(false);
     setIsLoading(false);
     if (animationFrameIdRef.current) {
       cancelAnimationFrame(animationFrameIdRef.current);
       animationFrameIdRef.current = null;
     }
     if (webcamRef.current && webcamRef.current.srcObject) {
       const stream = webcamRef.current.srcObject as MediaStream;
       stream.getTracks().forEach((track) => track.stop());
       webcamRef.current.srcObject = null;
     }
     // Clear hold timer when stopping detection
     clearGestureHoldTimer();
     // Reset detected gesture state
     setDetectedGesture('None');
     setConfidence(0);
   };

   // safePlayAudio remains mostly the same, using audioPlayerRef as per the input code
   const safePlayAudio = useCallback((gesture: string) => {
     const audioElement = audioElementsRef.current[gesture]; // Still need this to get the src
     if (!audioElement || !hasInteractedRef.current || !audioPlayerRef.current) {
       console.log('Audio play prevented:', {
         hasAudioElement: !!audioElement,
         hasInteracted: hasInteractedRef.current,
         hasAudioPlayer: !!audioPlayerRef.current,
         gesture,
       });
       return false;
     }

     const now = Date.now();
     // Adjust cooldowns if needed, considering the 3-second hold requirement
     const generalCooldown = 1000; // Cooldown between *any* audio plays
     // Repeat cooldown might be less critical now due to hold time, but can keep it
     const repeatCooldown = GESTURE_HOLD_DURATION + 1000; // E.g., Hold time + 1 sec

     if (now - lastPlayedTimeRef.current < generalCooldown) {
        // console.log('General cooldown active');
       return false;
     }
     // Check if this exact gesture sound finished playing recently
     if (gesture === lastGestureRef.current && now - lastPlayedTimeRef.current < repeatCooldown) {
        // console.log(`Repeat cooldown active for ${gesture}`);
       return false;
     }

     try {
       // Set source on the main audio player and play
       if (audioPlayerRef.current.src !== audioElement.src) {
         audioPlayerRef.current.src = audioElement.src;
         audioPlayerRef.current.load(); // Load the new source
       }

       const playPromise = audioPlayerRef.current.play();

       if (playPromise !== undefined) {
         playPromise
           .then(() => {
             lastPlayedTimeRef.current = now;
             lastGestureRef.current = gesture; // Track that this gesture's sound started playing
             console.log(`Playing audio for: ${gesture}`);
           })
           .catch((err) => {
             if (err.name === 'NotAllowedError') {
               console.warn('Audio play prevented by browser policy.');
               setError('Browser prevented audio playback. Interact with the page maybe?');
             } else {
               console.error('Audio play failed:', err);
             }
           });
       }
       return true;
     } catch (e) {
       console.error('Audio play error:', e);
       return false;
     }
     // Reset lastGestureRef when audio finishes playing (using the onEnded prop on the <audio> element is simpler here)
   }, [clearGestureHoldTimer]); // Add clearGestureHoldTimer if it were used inside, but it isn't directly


   // --- Main Detection Loop ---
   useEffect(() => {
     if (!isDetecting || !modelRef.current || !webcamRef.current) {
       return; // Exit if not detecting, model not loaded, or webcam ref not set
     }

     let isRunning = true;

     const predict = async () => {
       if (!isRunning || !modelRef.current || !webcamRef.current || !webcamRef.current.readyState || webcamRef.current.readyState < 3) {
            if (isRunning) animationFrameIdRef.current = requestAnimationFrame(predict);
            return;
       }

       try {
         const prediction = await modelRef.current.predict(webcamRef.current);
         prediction.sort((a, b) => b.probability - a.probability);
         const topPrediction = prediction[0];

         // Update state for UI display
         setDetectedGesture(topPrediction.className);
         setConfidence(topPrediction.probability);

         // --- Gesture Hold Logic ---
         const currentGesture = topPrediction.className;
         const currentConfidence = topPrediction.probability;
         const isConfidentTriggerGesture =
             TRIGGERABLE_GESTURES.has(currentGesture.toLowerCase()) &&
             currentConfidence > CONFIDENCE_THRESHOLD;

         // Check if conditions are met to potentially START or CONTINUE hold timer
         if (isConfidentTriggerGesture) {
             // Is this the start of tracking this specific gesture?
             if (currentTrackedGestureRef.current !== currentGesture) {
                 // It's a new gesture or confidence was lost and regained. Clear any old timer.
                 // console.log(`Detected potential trigger gesture: ${currentGesture}. Starting timer.`);
                 clearGestureHoldTimer(); // Clear previous timer/tracking

                 currentTrackedGestureRef.current = currentGesture;
                 gestureStartTimeRef.current = Date.now();

                 // Set the timeout to trigger audio after the hold duration
                 triggerTimeoutRef.current = setTimeout(() => {
                     console.log(`Held ${currentGesture} for ${GESTURE_HOLD_DURATION}ms. Attempting to play audio.`);
                     // Double-check if still the same gesture when timeout fires (optional, good practice)
                     if (currentTrackedGestureRef.current === currentGesture) {
                         safePlayAudio(currentGesture);
                     }
                     // Important: Reset tracking *after* attempting play to allow cooldowns in safePlayAudio
                     triggerTimeoutRef.current = null; // Timer has fired
                     currentTrackedGestureRef.current = null;
                     gestureStartTimeRef.current = null;
                 }, GESTURE_HOLD_DURATION);
             }
             // Else: Same gesture is already being tracked, timer is running or has fired. Do nothing here.
         }
         // If conditions are NOT met (wrong gesture, 'none', low confidence)
         else {
             // If we were tracking a gesture, clear the timer because the hold was broken
             if (currentTrackedGestureRef.current) {
                 // console.log(`Hold broken for ${currentTrackedGestureRef.current}. Clearing timer.`);
                 clearGestureHoldTimer();
             }
             // Else: We weren't tracking anything anyway. Do nothing.
         }
         // --- End Gesture Hold Logic ---

       } catch (error) {
         console.error('Error during prediction:', error);
         setError('Error during gesture detection.');
         stopDetection(); // This already calls clearGestureHoldTimer
         isRunning = false;
       } finally {
            if (isRunning) {
                 animationFrameIdRef.current = requestAnimationFrame(predict);
            }
       }
     };

     // --- Setup Webcam ---
     const setupWebcam = async () => {
        // (Setup Webcam logic remains the same as previous versions)
        // ... [omitted for brevity, assume it's the same as your last version] ...
       try {
         const stream = await navigator.mediaDevices.getUserMedia({
           video: {
                facingMode: "user", // Prefer front camera
                width: { ideal: 400 }, // Request ideal size
                height: { ideal: 400 }
           },
           audio: false // No audio needed from webcam
         });
         if (webcamRef.current) {
           webcamRef.current.srcObject = stream;
           webcamRef.current.onloadedmetadata = () => {
             if (webcamRef.current) { // Check ref again inside async callback
                webcamRef.current.play().then(() => {
                    setIsLoading(false); // Hide loader once video starts playing
                    console.log('Webcam started');
                    predict(); // Start the prediction loop
                }).catch(err => {
                    console.error("Webcam play failed:", err);
                    setError("Could not start webcam video.");
                    setIsLoading(false);
                    setIsDetecting(false);
                });
             }
           };
         } else {
             throw new Error("Webcam ref became null");
         }
       } catch (err: any) {
         console.error('Error accessing webcam:', err);
         // ... (error handling for webcam permissions etc.) ...
         if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
             setError('Camera permission denied. Please allow camera access in your browser settings.');
         } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError'){
             setError('No camera found. Please ensure a camera is connected and enabled.');
         } else {
             setError('Could not access webcam. See console for details.');
         }
         setIsLoading(false);
         setIsDetecting(false);
         isRunning = false; // Stop loop if webcam fails
       }

     };

     setupWebcam();

     // --- Cleanup Function ---
     return () => {
       console.log('Cleaning up detection effect');
       isRunning = false;
       if (animationFrameIdRef.current) {
         cancelAnimationFrame(animationFrameIdRef.current);
         animationFrameIdRef.current = null;
       }
       // Clear hold timer on cleanup
       clearGestureHoldTimer();
       // Stop webcam tracks
       if (webcamRef.current && webcamRef.current.srcObject) {
         const stream = webcamRef.current.srcObject as MediaStream;
         stream.getTracks().forEach((track) => track.stop());
         webcamRef.current.srcObject = null;
         console.log('Webcam stopped');
       }
       // Optional: Stop audio if playing
        if (audioPlayerRef.current && !audioPlayerRef.current.paused) {
            audioPlayerRef.current.pause();
            audioPlayerRef.current.currentTime = 0;
        }
     };
   }, [isDetecting, safePlayAudio, clearGestureHoldTimer]); // Add dependencies

   // --- JSX Structure (Using the structure from the input code) ---
   return (
     <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-4 md:p-8">
       <div className="max-w-4xl mx-auto">
         <header className="text-center mb-8">
           <h1 className="text-3xl md:text-4xl font-bold text-slate-800 mb-2">Meret Oppenheim</h1>
           {/* Add description if desired */}
           <p className="text-slate-600">Hold a gesture for 3 seconds to trigger audio.</p>
         </header>

         {error && (
           <div className="mb-6 p-4 bg-red-100 border border-red-300 rounded-lg text-red-700">
             <p><strong>Error:</strong> {error}</p>
           </div>
         )}

         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           {/* Camera Feed Card */}
           <Card className="md:col-span-2 p-4 shadow-md">
             <div className="flex justify-between items-center mb-4">
               <h2 className="text-xl font-semibold text-slate-700">Camera Feed</h2>
               {!isDetecting ? (
                 <Button onClick={handleStartDetection} disabled={isLoading || !modelRef.current || !!error}>
                   {/* Button Content */}
                   {isLoading ? ( <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Initializing...</> )
                   : ( <><Camera className="mr-2 h-4 w-4" /> Start Detection</> )}
                 </Button>
               ) : (
                 <Button variant="outline" onClick={stopDetection}> Stop Detection </Button>
               )}
             </div>

             <div className="relative rounded-lg overflow-hidden bg-slate-200 aspect-square flex items-center justify-center">
                {/* Conditional Rendering for different states */}
               {!isDetecting && !isLoading && modelStatus !== 'Model loaded successfully!' && ( /* Loading Model */
                  <div className="text-center p-6"><Loader2 className="h-12 w-12 text-slate-400 mx-auto mb-2 animate-spin" /><p className="text-slate-600">{modelStatus}</p></div>
               )}
                {!isDetecting && !isLoading && modelStatus === 'Model loaded successfully!' && !error && ( /* Ready to Start */
                    <div className="text-center p-6"><Info className="h-12 w-12 text-slate-400 mx-auto mb-2" /><p className="text-slate-600">Click "Start Detection" to enable your camera.</p></div>
                )}
                 {!isDetecting && error && ( /* Error State */
                     <div className="text-center p-6 text-red-600"><Info className="h-12 w-12 text-red-400 mx-auto mb-2" /><p>{error || 'An error occurred.'}</p><p className="text-sm mt-2">Check console or permissions.</p></div>
                 )}
               {/* Video element */}
               <video ref={webcamRef} className={`w-full h-full object-cover ${!isDetecting ? 'hidden' : ''}`} autoPlay muted playsInline />
                {/* Loading overlay */}
                {isLoading && isDetecting && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50"><Loader2 className="h-12 w-12 text-white animate-spin" /></div>
                )}
             </div>
           </Card>

           {/* Sidebar Cards */}
           <div className="space-y-6">
             {/* Detected Gesture Card */}
             <Card className="p-4 shadow-md">
               <h2 className="text-xl font-semibold text-slate-700 mb-4">Detected Gesture</h2>
               <div className="bg-slate-100 rounded-lg p-4 min-h-[100px] flex flex-col items-center justify-center text-center">
                 <div className="text-lg font-medium text-slate-700 break-words"> {detectedGesture} </div>
                 {/* Display hold status (Optional UI feedback) */}
                 {currentTrackedGestureRef.current && gestureStartTimeRef.current && (
                     <div className="text-xs text-blue-600 mt-1 animate-pulse">
                         Holding {currentTrackedGestureRef.current}...
                     </div>
                 )}
                 {confidence > 0 && detectedGesture !== 'None' && (
                   <span className="text-sm text-slate-500 mt-1">Confidence: {(confidence * 100).toFixed(1)}%</span>
                 )}
                 {detectedGesture === 'None' && !isDetecting && <span className="text-slate-500 text-sm">Detection stopped</span>}
                 {detectedGesture === 'None' && isDetecting && !currentTrackedGestureRef.current && <span className="text-slate-500 text-sm">No specific gesture detected</span>}
               </div>
             </Card>

             {/* Audio Player Card (As per input code) */}
             <Card className="p-4 shadow-md">
               <h2 className="text-xl font-semibold text-slate-700 mb-4">Audio Player</h2>
               <div className="bg-slate-100 rounded-lg p-4">
                <div className="flex items-center justify-center mb-3">
                   <Volume2 className="h-6 w-6 text-slate-600 mr-2" />
                   <span className="text-slate-600">Last Triggered Sound</span>
                 </div>
                 <audio
                   ref={audioPlayerRef}
                   controls
                   className="w-full"
                   preload="auto"
                    // Reset last *played* gesture ref when audio naturally ends
                   onEnded={() => { lastGestureRef.current = 'None'; }}
                 />
               </div>
                {!hasInteractedRef.current && modelRef.current && (
                    <p className="text-xs text-slate-500 mt-2 text-center">Click "Start Detection" to enable audio.</p>
                )}
             </Card>
           </div>
         </div>
       </div>
     </main>
   );
 }