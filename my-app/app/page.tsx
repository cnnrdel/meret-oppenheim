'use client';

 import { useState, useEffect, useRef, useCallback } from 'react';
 import { Button } from '@/components/ui/button';
 import { Card } from '@/components/ui/card';
 import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
 import { Loader2, Info, Volume2, Camera } from 'lucide-react';

 import * as tmImage from '@teachablemachine/image';

 // --- Configuration ---
 const MODEL_URL = '/tm-my-image-model/model.json'; // Make sure this points to your NEW model
 const METADATA_URL = '/tm-my-image-model/metadata.json'; // Make sure this points to your NEW metadata
 const CONFIDENCE_THRESHOLD = 0.7; // Adjust confidence as needed

 // --- Define Audio Paths (REPLACE THESE WITH YOUR ACTUAL FILE PATHS) ---
 const AUDIO_PATHS: Record<string, string> = {
   holding: '/audio/holding.mp3', // Example path
   stirring: '/audio/stirring.mp3', // Example path
   resting: '/audio/resting.mp3',  // Example path
   tilting: '/audio/tilting.mp3',  // Example path
   // Add more mappings here if needed, e.g., peace: '/audio/peace_sound.mp3'
   // Note: 'none' is intentionally excluded as it shouldn't trigger audio
 };

 // Define which gestures should trigger audio
 const TRIGGERABLE_GESTURES = new Set(['holding', 'stirring', 'resting', 'tilting']);

 export default function Home() {
   const webcamRef = useRef<HTMLVideoElement>(null);
   const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
   const lastPlayedTimeRef = useRef<number>(0);
   const lastGestureRef = useRef<string>('None'); // Start with 'None' or the actual label name from model
   const hasInteractedRef = useRef<boolean>(false);
   const modelRef = useRef<tmImage.CustomMobileNet | null>(null);
   const animationFrameIdRef = useRef<number | null>(null);
   const audioElementsRef = useRef<Record<string, HTMLAudioElement>>({}); // To store preloaded audio elements

   const [isDetecting, setIsDetecting] = useState(false);
   const [isLoading, setIsLoading] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [detectedGesture, setDetectedGesture] = useState('None'); // Default state
   const [confidence, setConfidence] = useState(0);
   const [modelStatus, setModelStatus] = useState('Loading Teachable Machine model...');
   const [labels, setLabels] = useState<string[]>([]);
   // No need for audioMappings state, we'll use AUDIO_PATHS directly with preloaded elements
   // const [audioMappings, setAudioMappings] = useState<Record<string, string>>({}); // Removed

   // Load Teachable Machine model
   useEffect(() => {
     async function loadModel() {
       try {
         setModelStatus('Loading model...');
         const model = await tmImage.load(MODEL_URL, METADATA_URL);
         modelRef.current = model;
         const modelLabels = model.getClassLabels();
         setLabels(modelLabels); // Store all labels from the model for UI display
         setModelStatus('Model loaded successfully!');

         // --- Preload Audio after model is loaded and labels are known ---
         const initialElements: Record<string, HTMLAudioElement> = {};
         modelLabels.forEach((label) => {
           const labelLower = label.toLowerCase(); // Use lowercase for consistency
           if (TRIGGERABLE_GESTURES.has(labelLower) && AUDIO_PATHS[labelLower]) {
             const audioPath = AUDIO_PATHS[labelLower];
             const audioElement = new Audio(audioPath);
             audioElement.load(); // Start loading the audio file
             initialElements[label] = audioElement; // Use original label case as key if needed by prediction
             console.log(`Preloading audio for: ${label} from ${audioPath}`);
           }
         });
         audioElementsRef.current = initialElements;
         // --- End Audio Preloading ---

       } catch (err: any) {
         console.error('Failed to load model:', err);
         setModelStatus('Failed to load model.');
         setError('Could not load the gesture detection model. Check console for details.');
         setIsLoading(false);
       }
     }

     loadModel();
     // Clean up function (optional but good practice for potential future async ops)
     return () => {
        // Cleanup logic if needed when component unmounts
     };
   }, []); // Empty dependency array ensures this runs only once on mount


   // --- Removed Preload useEffect, incorporated into model loading useEffect ---

   const handleStartDetection = () => {
     setError(null);
     setIsLoading(true);
     setIsDetecting(true);
     hasInteractedRef.current = true; // User interaction confirmed
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
     // Optionally reset detected gesture state
     setDetectedGesture('None');
     setConfidence(0);
   };

   // Use useCallback to memoize the function, preventing unnecessary re-renders
   const safePlayAudio = useCallback((gesture: string) => {
    // Check if gesture is triggerable and has a preloaded audio element
     const audioElement = audioElementsRef.current[gesture];
     if (!audioElement || !hasInteractedRef.current) {
       console.log('Audio play prevented:', {
         hasAudioElement: !!audioElement,
         hasInteracted: hasInteractedRef.current,
         gesture,
       });
       return false; // Cannot play if no audio element or no user interaction
     }

     const now = Date.now();
     const generalCooldown = 1000; // Minimum time between any sound playing
     const repeatCooldown = 2000; // Minimum time before repeating the *same* sound

     if (now - lastPlayedTimeRef.current < generalCooldown) {
        // console.log('General cooldown active');
       return false; // Too soon since the last sound
     }
     if (gesture === lastGestureRef.current && now - lastPlayedTimeRef.current < repeatCooldown) {
        // console.log(`Repeat cooldown active for ${gesture}`);
       return false; // Too soon to repeat the same gesture's sound
     }

     try {
       // Use the shared audio player element, setting the source from the preloaded element
       if (audioPlayerRef.current) {
         // Check if the source needs updating (might not be necessary if preloaded element is played directly)
         // This approach uses ONE <audio> element and changes its src.
         if (audioPlayerRef.current.src !== audioElement.src) {
             audioPlayerRef.current.src = audioElement.src;
             audioPlayerRef.current.load(); // Load the new source
         }

         // Alternative: Play the preloaded element directly (might need multiple audio elements or careful management)
         // audioElement.currentTime = 0; // Reset playback
         // const playPromise = audioElement.play();

         const playPromise = audioPlayerRef.current.play();

         if (playPromise !== undefined) {
           playPromise
             .then(() => {
               lastPlayedTimeRef.current = now;
               lastGestureRef.current = gesture;
               console.log(`Playing audio for: ${gesture}`);
             })
             .catch((err) => {
                 // Common error: User hasn't interacted with the page yet.
                 if (err.name === 'NotAllowedError') {
                     console.warn('Audio play prevented by browser policy. Ensure user interaction first.');
                     setError('Browser prevented audio playback. Click "Start Detection" or interact with the page.');
                 } else {
                     console.error('Audio play failed:', err);
                 }
             });
         }
         return true;
       } else {
         console.error('audioPlayerRef is null');
         return false;
       }
     } catch (e) {
       console.error('Audio play error:', e);
       return false;
     }
   }, []); // Empty dependency array: This function doesn't depend on component state/props


   // --- Main Detection Loop ---
   useEffect(() => {
     if (!isDetecting || !modelRef.current || !webcamRef.current) {
       return; // Exit if not detecting, model not loaded, or webcam ref not set
     }

     let isRunning = true; // Flag to control the loop

     const predict = async () => {
       // Guard clauses
       if (!isRunning || !modelRef.current || !webcamRef.current || !webcamRef.current.readyState || webcamRef.current.readyState < 3) {
           // Check if webcam is ready (readyState 3 or 4 means enough data)
            if (isRunning) animationFrameIdRef.current = requestAnimationFrame(predict); // Continue trying if still running
            return;
       }


       try {
         const prediction = await modelRef.current.predict(webcamRef.current);
         // Sort by probability descending to get the top prediction
         prediction.sort((a, b) => b.probability - a.probability);
         const topPrediction = prediction[0];

         // Update state with the detected gesture and confidence
         setDetectedGesture(topPrediction.className);
         setConfidence(topPrediction.probability);

         // --- Check if the detected gesture should trigger audio ---
         const currentGesture = topPrediction.className; // Use original label case
         const currentGestureLower = topPrediction.className.toLowerCase();

         // Check confidence, if the gesture is in our trigger list, and if audio is preloaded
         if (
           topPrediction.probability > CONFIDENCE_THRESHOLD &&
           TRIGGERABLE_GESTURES.has(currentGestureLower) &&
           audioElementsRef.current[currentGesture] // Check using original case key
         ) {
           safePlayAudio(currentGesture); // Pass the original case gesture name
         } else if (topPrediction.probability > CONFIDENCE_THRESHOLD && currentGestureLower === 'none') {
            // Optional: Handle 'none' state if needed, e.g., stop currently playing audio
            // if (audioPlayerRef.current && !audioPlayerRef.current.paused) {
            //    audioPlayerRef.current.pause();
            //    lastGestureRef.current = 'None'; // Reset last gesture
            // }
         }

       } catch (error) {
         console.error('Error during prediction:', error);
         setError('Error during gesture detection.');
         stopDetection(); // Stop detection on error
         isRunning = false; // Stop the loop
       } finally {
            // Request the next frame only if the loop should continue
            if (isRunning) {
                 animationFrameIdRef.current = requestAnimationFrame(predict);
            }
       }
     };

     // --- Setup Webcam ---
     const setupWebcam = async () => {
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
           // Wait for the video metadata to load to get correct dimensions
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
       isRunning = false; // Signal the loop to stop
       if (animationFrameIdRef.current) {
         cancelAnimationFrame(animationFrameIdRef.current);
         animationFrameIdRef.current = null;
       }
       // Stop webcam tracks when component unmounts or isDetecting changes to false
       if (webcamRef.current && webcamRef.current.srcObject) {
         const stream = webcamRef.current.srcObject as MediaStream;
         stream.getTracks().forEach((track) => track.stop());
         webcamRef.current.srcObject = null;
         console.log('Webcam stopped');
       }
     };
     // Dependencies: Trigger effect when isDetecting changes or safePlayAudio is updated (though it's memoized)
   }, [isDetecting, safePlayAudio]);

   // --- JSX Structure (UI) ---
   return (
     <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-4 md:p-8">
       <div className="max-w-4xl mx-auto">
         {/* Header */}
         <header className="text-center mb-8">
           <h1 className="text-3xl md:text-4xl font-bold text-slate-800 mb-2">Meret Oppenheim</h1>
         </header>

         {/* Error Display */}
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
                   {isLoading ? (
                     <>
                       <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                       Initializing...
                     </>
                   ) : (
                     <>
                       <Camera className="mr-2 h-4 w-4" />
                       Start Detection
                     </>
                   )}
                 </Button>
               ) : (
                 <Button variant="outline" onClick={stopDetection}>
                   Stop Detection
                 </Button>
               )}
             </div>

             <div className="relative rounded-lg overflow-hidden bg-slate-200 aspect-square flex items-center justify-center">
               {/* Conditional Rendering based on state */}
               {!isDetecting && !isLoading && modelStatus !== 'Model loaded successfully!' && (
                  <div className="text-center p-6">
                      <Loader2 className="h-12 w-12 text-slate-400 mx-auto mb-2 animate-spin" />
                      <p className="text-slate-600">{modelStatus}</p>
                  </div>
               )}
                {!isDetecting && !isLoading && modelStatus === 'Model loaded successfully!' && !error && (
                    <div className="text-center p-6">
                        <Info className="h-12 w-12 text-slate-400 mx-auto mb-2" />
                        <p className="text-slate-600">
                        Click "Start Detection" to enable your camera and begin gesture recognition.
                        </p>
                    </div>
                )}
                 {!isDetecting && error && (
                     <div className="text-center p-6 text-red-600">
                         <Info className="h-12 w-12 text-red-400 mx-auto mb-2" />
                         <p>{error || 'An error occurred.'}</p>
                         <p className="text-sm mt-2">Please check permissions or console for more details.</p>
                     </div>
                 )}
               {/* Video element */}
               <video
                 ref={webcamRef}
                 className={`w-full h-full object-cover ${!isDetecting ? 'hidden' : ''}`} // Hide if not detecting
                 autoPlay
                 muted // Muted is important for autoplay policies
                 playsInline // Important for iOS
               />
                {/* Loading overlay */}
                {isLoading && isDetecting && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                         <Loader2 className="h-12 w-12 text-white animate-spin" />
                    </div>
                )}
             </div>
           </Card>

           {/* Sidebar Cards */}
           <div className="space-y-6">
             {/* Detected Gesture Card */}
             <Card className="p-4 shadow-md">
               <h2 className="text-xl font-semibold text-slate-700 mb-4">Detected Gesture</h2>
               <div className="bg-slate-100 rounded-lg p-4 min-h-[100px] flex flex-col items-center justify-center text-center">
                 <div className="text-lg font-medium text-slate-700 break-words">
                   {detectedGesture}
                 </div>
                 {confidence > 0 && detectedGesture !== 'None' && (
                   <span className="text-sm text-slate-500 mt-1">Confidence: {(confidence * 100).toFixed(1)}%</span>
                 )}
                 {detectedGesture === 'None' && !isDetecting && <span className="text-slate-500 text-sm">Detection stopped</span>}
                 {detectedGesture === 'None' && isDetecting && <span className="text-slate-500 text-sm">No specific gesture detected</span>}

               </div>
             </Card>

             {/* Audio Player Card */}
             <Card className="p-4 shadow-md">
               <h2 className="text-xl font-semibold text-slate-700 mb-4">Audio Player</h2>
               <div className="bg-slate-100 rounded-lg p-4">
                 <div className="flex items-center justify-center mb-3">
                   <Volume2 className="h-6 w-6 text-slate-600 mr-2" />
                   <span className="text-slate-600">Last Triggered Sound</span>
                 </div>
                 {/* Single Audio Element controlled by the safePlayAudio function */}
                 <audio
                   ref={audioPlayerRef}
                   controls
                   className="w-full"
                   preload="auto" // Preload 'auto' is fine here, specific files preloaded elsewhere
                   onEnded={() => { lastGestureRef.current = 'None'; }} // Optional: Reset last gesture when audio finishes
                 />
               </div>
               {/* Display interaction requirement hint */}
               {!hasInteractedRef.current && modelRef.current && (
                  <p className="text-xs text-slate-500 mt-2 text-center">Click "Start Detection" to enable audio.</p>
               )}
             </Card>

             {/* Instructions Card */}
             
           </div>
         </div>
       </div>
     </main>
   );
 }