import Link from "next/link";

export const metadata = { title: "Merci pour votre avis — MS Adhésif" };

export default function ReviewThankYouPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 max-w-md w-full text-center">
        <div className="text-6xl mb-6">🎉</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Merci pour votre avis !</h1>
        <p className="text-gray-500 mb-8">
          Votre retour nous aide à améliorer nos produits et à aider d&apos;autres clients à faire le bon choix.
        </p>
        <Link
          href="/"
          className="inline-block bg-gray-900 text-white px-8 py-3 rounded-xl font-medium hover:bg-gray-800 transition"
        >
          Retour à la boutique
        </Link>
      </div>
    </div>
  );
}
