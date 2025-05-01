// app/instructions/page.tsx
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

// Define the gestures and their actions based on your configuration
// It's good practice to keep this consistent with your main page logic
// You could potentially fetch this dynamically or share config if it gets complex
const gestures = [
  { name: 'holding', triggersAudio: true },
  { name: 'stirring', triggersAudio: true },
  { name: 'resting', triggersAudio: true },
  { name: 'tilting', triggersAudio: true },
  { name: 'none', triggersAudio: false },
  // Add any other labels your model might have, e.g.:
  // { name: 'background', triggersAudio: false },
];

export default function InstructionsPage() {
  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto bg-white p-6 md:p-10 rounded-lg shadow">
        <nav className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center text-blue-600 hover:text-blue-800 hover:underline transition-colors"
          >
            <ArrowLeft className="mr-2 h-5 w-5" />
            Back to Gesture Detection
          </Link>
        </nav>

        <header className="mb-8 border-b pb-4">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-800">
            Gesture-Controlled Audio Instructions
          </h1>
        </header>

        <section aria-labelledby="setup-heading" className="mb-8">
          <h2 id="setup-heading" className="text-2xl font-semibold text-slate-700 mb-4">
            Setup Guide
          </h2>
          <p className="mb-4 text-slate-600">
            Follow these steps to use the gesture detection feature:
          </p>
          <ol className="list-decimal pl-6 space-y-3 text-slate-600">
            <li>
              Ensure you are using a device with a working camera and a modern web browser (like Chrome, Firefox, Edge, or Safari).
            </li>
            <li>
              Navigate back to the{' '}
              <Link href="/" className="text-blue-600 hover:underline">main page</Link>.
            </li>
            <li>
              Click the "Start Detection" button.
            </li>
            <li>
              Your browser will ask for permission to use your camera. Please click "Allow". If you accidentally block it, you may need to reset permissions in your browser's settings for this site.
            </li>
            <li>
              Once the camera feed appears, position yourself so your hand gestures are clearly visible within the frame. Good lighting helps!
            </li>
            <li>
              The application will start detecting gestures immediately.
            </li>
          </ol>
        </section>

        <section aria-labelledby="gestures-heading" className="mb-8">
          <h2 id="gestures-heading" className="text-2xl font-semibold text-slate-700 mb-4">
            Recognized Gestures
          </h2>
          <p className="mb-4 text-slate-600">
            The system is trained to recognize the following gestures. Performing a trigger gesture will play a corresponding sound:
          </p>
          <ul className="list-disc pl-6 space-y-3 text-slate-600">
            {gestures.map((gesture) => (
              <li key={gesture.name}>
                <strong>{gesture.name.charAt(0).toUpperCase() + gesture.name.slice(1)}:</strong>
                {gesture.triggersAudio
                  ? ' Plays an associated sound when detected with high confidence.'
                  : ' This gesture is recognized but does not trigger a sound.'}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-slate-600 italic">
            For best results, hold your gesture clearly and steadily in front of the camera.
          </p>
        </section>

         <section aria-labelledby="troubleshooting-heading">
             <h2 id="troubleshooting-heading" className="text-2xl font-semibold text-slate-700 mb-4">
                 Troubleshooting
             </h2>
             <ul className="list-disc pl-6 space-y-3 text-slate-600">
                   <li>
                       <strong>No camera feed / Permission error:</strong> Check your browser's site settings to ensure camera access is allowed for this page. Make sure no other application is using the camera.
                   </li>
                   <li>
                       <strong>Gestures not detected accurately:</strong> Ensure good lighting conditions. Avoid cluttered backgrounds. Hold gestures clearly and within the camera's view.
                   </li>
                    <li>
                       <strong>No sound plays:</strong> Ensure your device's volume is turned up and not muted. Sounds only play for specific gestures (holding, stirring, resting, tilting) when detected confidently. There's also a short cooldown period between sounds.
                   </li>
             </ul>
         </section>

      </div>
    </main>
  );
}

// Optional: Add metadata for SEO and accessibility
export const metadata = {
  title: 'Gesture Audio Instructions',
  description: 'How to set up and use the gesture-controlled audio application.',
};