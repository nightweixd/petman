/** A decorative, code-native illustration shared by the PetMan welcome surfaces. */
export default function PetIllustration({
  className = "",
}: {
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 300 220"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id="petman-orb" cx=".32" cy=".25" r=".8">
          <stop stopColor="#fff" />
          <stop offset=".6" stopColor="#dcf6fa" />
          <stop offset="1" stopColor="#a9e1ec" />
        </radialGradient>
        <linearGradient
          id="petman-coat"
          x1="125"
          y1="77"
          x2="186"
          y2="183"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#fff4da" />
          <stop offset="1" stopColor="#efce9e" />
        </linearGradient>
      </defs>
      <circle cx="159" cy="113" r="94" fill="url(#petman-orb)" />
      <circle cx="259" cy="53" r="13" fill="#bde8f0" />
      <circle cx="48" cy="156" r="20" fill="#d5eef6" />
      <circle cx="83" cy="28" r="7" fill="#fff" />
      <ellipse cx="162" cy="194" rx="71" ry="9" fill="#578b9b" opacity=".13" />
      <path
        d="M113 121c-20-22-30-14-31 4-1 17 12 40 27 35l13-17-9-22Z"
        fill="#b98556"
      />
      <path
        d="M194 111c20-15 32-4 28 16-3 15-15 32-28 25l-8-21 8-20Z"
        fill="#b98556"
      />
      <path
        d="M106 139c0-42 18-66 51-66 36 0 57 26 57 64v24c0 25-22 36-55 36-32 0-53-10-53-35v-23Z"
        fill="url(#petman-coat)"
      />
      <path
        d="M114 99c11-18 22-23 40-25-14 9-16 22-16 34 0 13-9 25-20 22-13-4-12-17-4-31Z"
        fill="#bf8d5f"
        opacity=".7"
      />
      <ellipse cx="143" cy="137" rx="5" ry="6" fill="#293c47" />
      <ellipse cx="185" cy="137" rx="5" ry="6" fill="#293c47" />
      <ellipse cx="164" cy="161" rx="26" ry="20" fill="#fff7e9" />
      <path
        d="M157 151c2-4 14-4 16 0 2 4-5 10-8 10s-10-6-8-10Z"
        fill="#344c56"
      />
      <path
        d="M154 167c6 8 17 8 22 0"
        stroke="#344c56"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path d="M160 174v7c0 9 12 9 12 0v-7" fill="#eaa3a4" />
      <circle cx="129" cy="155" r="8" fill="#e8b2a0" opacity=".5" />
      <circle cx="198" cy="155" r="8" fill="#e8b2a0" opacity=".5" />
      <g transform="rotate(-12 64 80)">
        <rect x="21" y="49" width="83" height="61" rx="19" fill="#fff" />
        <rect x="26" y="54" width="73" height="51" rx="15" stroke="#dcecf0" />
        <circle cx="49" cy="80" r="13" fill="#ddf5f3" />
        <path
          d="m43 80 4 4 8-9"
          stroke="#23897c"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M70 75h16M70 84h10"
          stroke="#b3c9d1"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </g>
      <g transform="rotate(12 240 165)">
        <rect x="215" y="143" width="58" height="48" rx="16" fill="#fff" />
        <path
          d="M237 172c-5 3-4 9 1 7 3-1 6-1 9 0 5 2 7-4 1-7l-4-4c-2-1-4 2-7 4Z"
          fill="#238da7"
        />
        <ellipse cx="232" cy="165" rx="3" ry="4" fill="#238da7" />
        <ellipse cx="240" cy="160" rx="3" ry="4" fill="#238da7" />
        <ellipse cx="248" cy="161" rx="3" ry="4" fill="#238da7" />
        <ellipse cx="255" cy="167" rx="3" ry="4" fill="#238da7" />
      </g>
      <path d="m224 18 2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5Z" fill="#6fc1d0" />
    </svg>
  );
}
