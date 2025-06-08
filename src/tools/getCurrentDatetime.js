async function getCurrentDatetime() {
	const now = new Date();

	return {
		content: [{
			type: 'text',
			text: JSON.stringify({
				now,
				nowLocaleString: now.toLocaleString(),
				nowIsoString: now.toISOString(),
				timezone: new Intl.DateTimeFormat().resolvedOptions().timeZone
			}, null, 2)
		}]
	};
}

export default getCurrentDatetime;