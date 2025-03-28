# ModelHub - 3D Model Marketplace

ModelHub is a modern web platform for discovering, buying, selling, and sharing high-quality 3D models. Built with Next.js 15 and Supabase.

![ModelHub Screenshot](public/website-image.png)

## Features
- **3D Model Marketplace**: Browse, search, and filter 3D models
- **User Authentication**: Secure login and registration
- **Model Upload**: Share your 3D creations with the community
- **3D Scanning**: Create 3D models from videos using your smartphone
- **User Dashboard**: Track downloads, likes, and earnings
- **Like System**: Save your favorite models
- **Responsive Design**: Works on desktop and mobile devices

## Tech Stack
- **Frontend**: Next.js 15, React 18, TypeScript
- **UI**: Tailwind CSS, shadcn/ui components
- **State Management**: React Context API
- **Authentication**: Supabase Auth
- **Database**: Supabase PostgreSQL
- **Storage**: Supabase Storage
- **Charts**: Recharts
- **Forms**: React Hook Form with Zod validation

## Getting Started

### Prerequisites
- Node.js 18+ and npm/yarn
- Supabase account

### Installation
1. Clone the repository:
   ```
   git clone https://github.com/yourusername/modelhub.git
   cd modelhub
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env.local` file with your Supabase credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. Start the development server:
   ```
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment
The application can be deployed to Vercel:
```
npm run build
```

## License
This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments
- [shadcn/ui](https://ui.shadcn.com/) for the component library
- [Lucide Icons](https://lucide.dev/) for the icon set
- [Tailwind CSS](https://tailwindcss.com/) for styling
