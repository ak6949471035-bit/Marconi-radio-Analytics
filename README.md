# Station Tracker

![Station Tracker Banner](assets/banner.png)

A self-hosted application for tracking and analyzing music played on radio stations. Station Tracker automatically monitors radio streams, identifies tracks and provides insight into played tracks.

## Features

- [x] **Live streaming** - Listen to all your radio stations from a single page
- [x] **Multi-Station Tracking** - Monitor multiple radio stations simultaneously
- [x] **Automatic Track Detection** - Identify played songs in real-time
- [x] **Track Search & Filtering** - Search through all tracked songs
- [x] **Favorites** - Save your favorite tracks for easy access
- [x] **Analytics** - Visualize your listening habits with detailed charts
- [x] **Track Preview** - Play previews of identified tracks
- [x] **External Links** - Quick access to Shazam and YouTube for each track
- [x] **Competitive Dashboard** - Compare station performance hour-by-hour
- [x] **Alert Rules** - Trigger in-app alerts when tracked keywords are played
- [x] **Branded Reports** - Export white-label HTML reports for clients
- [x] **Recognition Quality Metrics** - Confidence score tracking per song
- [x] **Responsive Design** - Works seamlessly on desktop and mobile devices

## Getting Started

### Docker

**Run with Docker:**

```bash
docker run -d -p 8000:8000 -v ./data:/data --restart unless-stopped lorisleitner/station-tracker:latest
```

Then open http://localhost:8000 in your browser.

**Run with Docker Compose:**

Create a `docker-compose.yml`:

```yaml
services:
  station-tracker:
    image: lorisleitner/station-tracker:latest
    restart: unless-stopped
    ports:
      - "8000:8000"
    volumes:
      - ./data:/data
```

Then run:

```bash
docker compose up -d
```

### Optional API key roles

If you want role-based API access (`admin` / `editor` / `viewer`), set:

```bash
API_KEYS_JSON='[{"key":"admin-key","role":"admin"},{"key":"viewer-key","role":"viewer"}]'
```

Then send the key in the `x-api-key` header.

## How to Use

### Adding Stations

1. Navigate to the **Stations** page (home page)
2. Click the **"Add"** button in the top right
3. Fill in the station details:
   - **Name**: A descriptive name for the radio station
   - **Stream URL**: The direct stream URL
   - **Interval (s)**: How often to sample the stream (minimum 30 seconds)
   - **Skip first (s)**: Seconds to skip at the start of each sample (useful for skipping ads)
   - **Enabled**: Toggle to enable/disable tracking for this station

The system will immediately start tracking the station and identifying tracks.

**Tips:**
- Use a longer interval (60-120 seconds) for stations that play longer songs
- Increase "Skip first" if the station injects ads at the beginning of streams

### Searching Through Tracks

1. Navigate to the **Tracks** page from the main navigation
2. Use the filter options:
   - **Stations**: Select one or more stations to filter by (or leave empty for all stations)
   - **From/To**: Set date range to filter tracks by when they were played
   - **Search**: Enter keywords to search in title, artist, album, year, genre, or station name
3. Click **"Search"** to apply filters

### Saving Favorites

There are multiple ways to favorite tracks:

**From the Stations page:**
1. Find a station card showing the current track
2. Click the **star icon** in the bottom right corner of the track card
3. The star will turn yellow, indicating the track is favorited

**From the Tracks page:**
1. Find the track in the tracks table
2. Click the **star icon** next to the track title
3. The star will turn yellow when favorited

**Viewing Favorites:**
1. Navigate to the **Favorites** page from the main navigation
2. All favorited tracks are displayed here
3. Use the same search and date filters as the Tracks page
4. Click the star icon again to remove a track from favorites

**Features:**
- Each favorite shows total play count across all stations
- Favorites are sorted by when they were favorited (most recent first)

### Getting Analytics

1. Navigate to the **Analytics** page from the main navigation
2. Optionally filter the data:
   - **Stations**: Select specific stations to analyze
   - **From/To**: Set date range for analysis
   - **Search**: Filter by track, artist, genre, etc.
3. Click **"Search"** to update the analytics

**Analytics Dashboard includes:**

- **Summary Cards**:
  - Total plays across all filtered tracks
  - Number of unique tracks
  - Number of unique artists
  - Number of unique genres

- **Visual Charts**:
  - **Top 10 Played Songs**: Bar chart showing most frequently played tracks
  - **Top 10 Played Artists**: Most popular artists by play count
  - **Top 10 Years**: Most played release years
  - **Top 10 Genres**: Most popular genres
  - **Top 10 Stations**: Stations with the most tracked plays

## Screenshots

![Screenshot 1](assets/screen1.png)

![Screenshot 2](assets/screen2.png)

![Screenshot 3](assets/screen3.png)

![Screenshot 4](assets/screen4.png)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[MIT License](LICENSE.txt)
